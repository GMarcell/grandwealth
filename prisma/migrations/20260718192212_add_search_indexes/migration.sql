-- CreateIndex
CREATE INDEX "BankSaving_userId_date_idx" ON "BankSaving"("userId", "date");

-- CreateIndex
CREATE INDEX "BankSaving_userId_accountName_idx" ON "BankSaving"("userId", "accountName");

-- CreateIndex
CREATE INDEX "BankSaving_userId_notes_idx" ON "BankSaving"("userId", "notes");

-- CreateIndex
CREATE INDEX "GoldDeposit_userId_date_idx" ON "GoldDeposit"("userId", "date");

-- CreateIndex
CREATE INDEX "GoldDeposit_userId_notes_idx" ON "GoldDeposit"("userId", "notes");

-- CreateIndex
CREATE INDEX "GoldDeposit_userId_type_date_idx" ON "GoldDeposit"("userId", "type", "date");

-- CreateIndex
CREATE INDEX "Stock_userId_date_idx" ON "Stock"("userId", "date");

-- CreateIndex
CREATE INDEX "Stock_userId_symbol_idx" ON "Stock"("userId", "symbol");

-- CreateIndex
CREATE INDEX "Stock_userId_name_idx" ON "Stock"("userId", "name");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userId_description_idx" ON "Transaction"("userId", "description");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_date_idx" ON "Transaction"("userId", "type", "date");
