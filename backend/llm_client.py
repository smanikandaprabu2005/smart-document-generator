"""
Centralized LLM client with Gemini → Groq fallback logic.
Handles rate limits, retries, and proper error reporting.
Production-ready with logging and configurable models.
"""

import os
import logging
import time
from typing import Optional
from google import genai as google_genai
from google.genai import types as google_types
from groq import Groq

logger = logging.getLogger(__name__)

# =====================
# Configuration
# =====================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

ENV = os.getenv("ENV", "dev")

# Retry settings
MAX_RETRIES = 2
INITIAL_BACKOFF = 1  # seconds


# =====================
# LLM Client
# =====================
class LLMClient:
    """
    Intelligent LLM client with Gemini → Groq fallback.
    
    Flow:
    1. Try Gemini (free tier)
    2. If Gemini fails (503, 429, or other errors), try Groq
    3. If both fail, return error with 503 status
    """

    def __init__(self):
        self.gemini_available = bool(GEMINI_API_KEY)
        self.groq_available = bool(GROQ_API_KEY)
        
        if self.gemini_available:
            self.gemini_client = google_genai.Client(api_key=GEMINI_API_KEY)
        
        if self.groq_available:
            self.groq_client = Groq(api_key=GROQ_API_KEY)
        
        logger.info(
            f"LLM Client initialized - Gemini: {self.gemini_available}, "
            f"Groq: {self.groq_available}"
        )

    def generate_text(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 180,
        use_fallback: bool = True
    ) -> Optional[str]:
        """
        Generate text using Gemini, fallback to Groq if needed.
        
        Args:
            prompt: The prompt to send to the LLM
            temperature: Sampling temperature (0-1)
            max_tokens: Max output tokens
            use_fallback: Whether to fallback to Groq if Gemini fails
        
        Returns:
            Generated text or None if all LLMs fail
        """
        # Try Gemini first
        if self.gemini_available:
            result = self._try_gemini(prompt, temperature, max_tokens)
            if result is not None:
                logger.info("Generated text using Gemini")
                return result

            if not use_fallback:
                logger.warning("Gemini failed and fallback disabled")
                return None

            logger.warning("Gemini failed, falling back to Groq")

        # Fallback to Groq
        if self.groq_available:
            result = self._try_groq(prompt, temperature, max_tokens)
            if result is not None:
                logger.info("Generated text using Groq (fallback)")
                return result
        
        # Both failed
        logger.error("All LLMs exhausted - returning None")
        return None

    def _try_gemini(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Optional[str]:
        """
        Attempt to generate text with Gemini.
        Handles rate limits and retries with exponential backoff.
        """
        
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = self.gemini_client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=prompt,
                    config=google_types.GenerateContentConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens
                    )
                )
                return response.text.strip()
            
            except Exception as e:
                error_str = str(e)
                status_code = self._extract_http_status(error_str)
                
                # Check for hard failures (rate limit, quota)
                if status_code in (429, 503):
                    logger.warning(
                        f"Gemini {status_code} error on attempt {attempt + 1}/{MAX_RETRIES + 1}: {e}"
                    )
                    if attempt < MAX_RETRIES:
                        wait_time = INITIAL_BACKOFF * (2 ** attempt)
                        logger.info(f"Waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        continue
                    else:
                        # Exhausted retries, fail gracefully
                        return None
                else:
                    # Other errors
                    logger.error(f"Gemini error (non-retryable): {e}")
                    return None
        
        return None

    def _try_groq(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Optional[str]:
        """
        Attempt to generate text with Groq.
        Handles rate limits and retries.
        """
        
        for attempt in range(MAX_RETRIES + 1):
            try:
                message = self.groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                return message.choices[0].message.content.strip()
            
            except Exception as e:
                error_str = str(e)
                
                # Check for rate limit
                if "429" in error_str:
                    logger.warning(
                        f"Groq 429 rate limit on attempt {attempt + 1}/{MAX_RETRIES + 1}: {e}"
                    )
                    if attempt < MAX_RETRIES:
                        wait_time = INITIAL_BACKOFF * (2 ** attempt)
                        logger.info(f"Waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        continue
                    else:
                        return None
                else:
                    logger.error(f"Groq error: {e}")
                    return None
        
        return None

    @staticmethod
    def _extract_http_status(error_str: str) -> Optional[int]:
        """Extract HTTP status code from error message."""
        import re
        match = re.search(r'(\d{3})', error_str)
        return int(match.group(1)) if match else None


# =====================
# Singleton instance
# =====================
_llm_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """Get or create the singleton LLM client."""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client


# =====================
# Health check
# =====================
def check_llm_health() -> dict:
    """
    Check LLM availability and return status.
    Used for /health/llm endpoint.
    """
    client = get_llm_client()
    
    gemini_status = "available" if client.gemini_available else "not_configured"
    groq_status = "available" if client.groq_available else "not_configured"
    
    # Try a simple test
    test_prompt = "Reply with 'OK'"
    test_result = client.generate_text(test_prompt, max_tokens=10)
    
    return {
        "primary_llm": {
            "provider": "Gemini",
            "model": GEMINI_MODEL,
            "status": gemini_status
        },
        "fallback_llm": {
            "provider": "Groq",
            "model": GROQ_MODEL,
            "status": groq_status
        },
        "test": "passed" if test_result else "failed",
        "environment": ENV
    }
