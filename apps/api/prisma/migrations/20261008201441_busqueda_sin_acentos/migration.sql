-- AlterTable
ALTER TABLE "people" ADD COLUMN     "searchName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "people_searchName_idx" ON "people"("searchName");

-- Rellena las fichas que ya existían. Es el mismo texto que arma searchText():
-- apellido y nombre, sin acentos y en minúscula.
UPDATE "people"
SET "searchName" = lower(
  translate(
    "lastName" || ' ' || "firstName",
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  )
);
