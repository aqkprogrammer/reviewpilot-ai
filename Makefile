# ReviewPilot AI — common tasks. Requires uv, pnpm, Postgres and (optionally) Redis.
API := apps/api

.PHONY: install dev api web worker migrate migration seed seed-demo test test-api test-web e2e typecheck docker-up docker-down super-admin

install:
	pnpm install
	cd $(API) && uv sync

dev:            ## API + web together (worker optional: jobs run inline without Redis)
	$(MAKE) -j2 api web

api:
	cd $(API) && uv run uvicorn app.main:app --reload --port 8000

web:
	pnpm --filter @reviewpilot/web dev

worker:
	cd $(API) && uv run arq app.worker.settings.WorkerSettings

migrate:
	cd $(API) && uv run alembic upgrade head

migration:      ## make migration m="describe change"
	cd $(API) && uv run alembic revision --autogenerate -m "$(m)"

seed:
	cd $(API) && uv run python -m app.cli seed

seed-demo:
	cd $(API) && uv run python -m app.cli seed-demo

super-admin:    ## make super-admin email=you@company.com name="Your Name"
	cd $(API) && uv run python -m app.cli create-super-admin --email "$(email)" --name "$(name)" --secret "$$SUPER_ADMIN_BOOTSTRAP_SECRET"

test: test-api test-web

test-api:
	cd $(API) && uv run pytest -q

test-web:
	pnpm --filter @reviewpilot/web test

e2e:
	pnpm --filter @reviewpilot/web test:e2e

typecheck:
	pnpm -r typecheck

docker-up:
	docker compose up --build

docker-down:
	docker compose down
