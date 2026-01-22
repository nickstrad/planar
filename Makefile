.PHONY: db/migrate
db/migrate:
	npx prisma migrate dev

.PHONY: db/studio
db/studio:
	npx prisma studio

.PHONY: db/reset
db/reset:
	npx prisma migrate reset --force
	npx prisma migrate dev --name init
	npx @better-auth/cli@latest generate

.PHONY: db/generate
db/generate:
	npx prisma generate