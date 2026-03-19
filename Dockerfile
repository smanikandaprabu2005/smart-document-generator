FROM python:3.11

# Install LibreOffice
RUN apt-get update && apt-get install -y libreoffice

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Expose port
EXPOSE 10000

# Run app with gunicorn
CMD ["gunicorn", "backend.app:app", "--bind", "0.0.0.0:10000", "--timeout", "120"]