FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY schedulingLogic/requirements.txt ./schedulingLogic/requirements.txt
RUN pip install --no-cache-dir -r schedulingLogic/requirements.txt

COPY schedulingLogic ./schedulingLogic

EXPOSE 8000

CMD ["uvicorn", "api:app", "--app-dir", "schedulingLogic", "--host", "0.0.0.0", "--port", "8000"]
