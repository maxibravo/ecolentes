-- Los expedientes que ya habían pasado por aprobación antes de que existiera el
-- código de anteojo quedaron sin ningún anteojo cargado: en la pantalla se ven
-- entregados pero sin código, y a la persona que llama con su papelito no se la
-- puede encontrar. Esto les crea los anteojos que les corresponden, con el mismo
-- criterio que usa el sistema: lejos y cerca son dos, y si la receta no dice
-- nada de cerca es uno solo de lejos.
WITH base AS (
  SELECT
    c.id AS case_id,
    c."createdAt" AS creado,
    d."deliveredAt" AS entregado,
    COALESCE(p."rawText", '') AS texto
  FROM cases c
  LEFT JOIN prescriptions p ON p."caseId" = c.id
  LEFT JOIN deliveries d ON d."caseId" = c.id
  WHERE c.stage IN ('PRODUCTION', 'RECEIVED', 'READY_FOR_PICKUP', 'DELIVERED', 'CLOSED')
    AND NOT EXISTS (SELECT 1 FROM glasses g WHERE g."caseId" = c.id)
),
pares AS (
  SELECT base.case_id, base.creado, base.entregado, k.kind, k.orden
  FROM base
  CROSS JOIN LATERAL (
    SELECT 'LEJOS'::"GlassesKind" AS kind, 1 AS orden
    WHERE base.texto !~* '(CERCA|ADD)' OR base.texto ~* 'LEJOS'
    UNION ALL
    SELECT 'CERCA'::"GlassesKind", 2
    WHERE base.texto ~* '(CERCA|ADD)'
  ) k
),
numerados AS (
  SELECT pares.*, row_number() OVER (ORDER BY creado, case_id, orden) AS n
  FROM pares
),
-- El número sigue donde quedó el último anteojo, para no chocar con los que ya
-- tienen código.
ultimo AS (
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::int), 0) AS numero
  FROM glasses
)
INSERT INTO glasses (id, code, "caseId", kind, "deliveredAt", "createdAt")
SELECT
  gen_random_uuid(),
  'ANT-' || lpad((ultimo.numero + numerados.n)::text, 4, '0'),
  numerados.case_id,
  numerados.kind,
  numerados.entregado,
  now()
FROM numerados, ultimo;
