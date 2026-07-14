-- Strip the .JK suffix from all stock symbols to normalize them
-- Yahoo Finance search returns symbols with .JK for IDX stocks,
-- but we want to store them cleanly and append .JK only during price lookups.
UPDATE "Stock" SET "symbol" = LEFT("symbol", LENGTH("symbol") - 3) WHERE "symbol" LIKE '%.JK';
