-- ================================================================
-- Migración: Agregar columna 'slug' a la tabla noticias
-- Ejecutar UNA SOLA VEZ en phpMyAdmin de Hostinger
-- ================================================================

-- 1. Agregar la columna slug
ALTER TABLE noticias 
    ADD COLUMN slug VARCHAR(350) DEFAULT NULL AFTER titulo,
    ADD UNIQUE KEY uq_slug (slug);

-- 2. Poblar slugs de las noticias existentes (función sin tildes)
UPDATE noticias SET slug = LOWER(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REGEXP_REPLACE(titulo, '[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ ]', ''),
    'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),
    'Á','a'),'É','e'),'Í','i'),'Ó','o'),'Ú','u'),
    'ñ','n'),'Ñ','n'),'ü','u'),'Ü','u'),
    ' - ','-'),': ','-'),': ','-'),', ','-'),': ','-'),' ','-'))
WHERE slug IS NULL OR slug = '';
