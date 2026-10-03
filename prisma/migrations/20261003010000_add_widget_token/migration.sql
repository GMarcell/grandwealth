-- Read-only credentials for phone home-screen widgets. Tokens are stored as a
-- SHA-256 hash (never plaintext) so a database leak cannot expose them.
CREATE TABLE "WidgetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Widget',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WidgetToken_tokenHash_key" ON "WidgetToken"("tokenHash");

CREATE INDEX "WidgetToken_userId_idx" ON "WidgetToken"("userId");

ALTER TABLE "WidgetToken" ADD CONSTRAINT "WidgetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
