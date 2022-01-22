SELECT
clss.oid::regclass AS "tableName",
attr.attname AS "name",
format_type(attr.atttypid, NULL) AS "type",
attr.attnotnull AS "notNullable",
attr.atthasdef AS "hasDefault",
CASE
  WHEN clss.relkind = 'S' THEN 'sequence'
  ELSE 'column'
END AS "relKind"
FROM pg_class clss, pg_attribute attr, pg_namespace nsp
WHERE
attr.attnum > 0
AND NOT attr.attisdropped
AND nsp.nspname NOT IN ('public','pg_catalog','information_schema','pg_toast')
AND clss.relnamespace = nsp.oid
AND attr.attrelid = clss.oid
AND (
  (
    clss.relkind = 'S'
    AND attr.attname = 'last_value'
  )
  OR clss.relkind = 'r'
)
