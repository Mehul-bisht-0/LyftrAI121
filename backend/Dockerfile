FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.in .
RUN pip install --no-cache-dir -r requirements.in

FROM python:3.11-slim
RUN useradd -m -u 1000 app && mkdir /data && chown app:app /data
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages \
     /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY app/ ./app/
USER app
EXPOSE 8000
# Shell form required: Railway injects $PORT; exec array does not expand env vars.
# --limit-concurrency: cap concurrent requests to mitigate HTTP/2 rapid-reset (CVE-2023-44487).
# --timeout-keep-alive: close idle keep-alive connections quickly to reduce attack surface.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --limit-concurrency 50 --timeout-keep-alive 5
