# ReviewPilot AI — background worker (ARQ). The task code lives in apps/api/app/worker,
# so this image reuses the API package. Build context: repository root.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv
RUN pip install --no-cache-dir uv && useradd --create-home --uid 10001 app
WORKDIR /srv/api

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/ ./
RUN uv sync --frozen --no-dev && chown -R app:app /srv/api
ENV PATH="/opt/venv/bin:$PATH"
USER app

CMD ["arq", "app.worker.settings.WorkerSettings"]
