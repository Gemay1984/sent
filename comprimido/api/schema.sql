-- ================================================================
-- SENTIDO VIAL QUINDÍO — Schema MySQL
-- Ejecutar en phpMyAdmin o desde la consola de Hostinger
-- ================================================================

CREATE DATABASE IF NOT EXISTS sentidovial_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sentidovial_db;

-- ── NOTICIAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS noticias (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    titulo      VARCHAR(300)  NOT NULL,
    extracto    TEXT          NOT NULL,
    contenido   LONGTEXT      NOT NULL,
    categoria   VARCHAR(80)   NOT NULL DEFAULT 'Movilidad',
    imagen_url  VARCHAR(600)  DEFAULT '',
    publicado   TINYINT(1)    NOT NULL DEFAULT 1,
    fecha       DATE          NOT NULL,
    creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── SIMULADORES / RECURSOS EDUCATIVOS ───────────────────────────
CREATE TABLE IF NOT EXISTS simuladores (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    titulo      VARCHAR(300)  NOT NULL,
    descripcion TEXT          NOT NULL,
    embed_html  LONGTEXT      NOT NULL,
    icono       VARCHAR(100)  DEFAULT 'fas fa-gamepad',
    color       VARCHAR(50)   DEFAULT '#ef4444',
    activo      TINYINT(1)    NOT NULL DEFAULT 1,
    creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── CLASIFICADOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clasificados (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tipo        ENUM('Venta','Empleo','Repuesto','Arriendo') NOT NULL DEFAULT 'Venta',
    titulo      VARCHAR(300)  NOT NULL,
    precio      DECIMAL(14,0) DEFAULT 0,
    ciudad      VARCHAR(100)  DEFAULT 'Armenia',
    whatsapp    VARCHAR(20)   NOT NULL,
    descripcion TEXT,
    imagen_url  VARCHAR(600)  DEFAULT '',
    aprobado    TINYINT(1)    NOT NULL DEFAULT 0,
    fecha       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── ASESORÍAS JURÍDICAS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asesorias (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(200)  NOT NULL,
    whatsapp    VARCHAR(20)   NOT NULL,
    entidad     VARCHAR(100)  DEFAULT '',
    tipo_caso   VARCHAR(100)  DEFAULT '',
    descripcion TEXT          NOT NULL,
    atendido    TINYINT(1)    NOT NULL DEFAULT 0,
    fecha       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── DATOS DE EJEMPLO ────────────────────────────────────────────
INSERT INTO noticias (titulo, extracto, contenido, categoria, imagen_url, fecha) VALUES
('SETTA confirma nueva rotación de Pico y Placa para el segundo semestre',
 'La Secretaría de Tránsito de Armenia anuncia ajustes en los horarios de restricción vehicular.',
 '<p>La Secretaría de Tránsito y Transporte de Armenia (SETTA) confirmó mediante decreto los ajustes a la rotación del Pico y Placa para el segundo semestre de 2026.</p><p>La restricción seguirá aplicando de lunes a viernes en el perímetro del centro histórico, entre las 7:00 AM y las 7:00 PM.</p>',
 'SETTA',
 'https://images.unsplash.com/photo-1506526135688-6d274092b77a?auto=format&fit=crop&q=80&w=1000',
 CURDATE());

INSERT INTO simuladores (titulo, descripcion, embed_html, icono, color) VALUES
('Examen Teórico Quindío',
 'Simulacro oficial basado en el Código Nacional de Tránsito.',
 '<style>body{font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:2rem;}h2{color:#fac213;margin-bottom:1.5rem;}button{display:block;width:100%;margin:0.5rem 0;padding:1rem;background:#1e293b;border:1px solid #334155;border-radius:0.5rem;color:#f8fafc;font-size:1rem;cursor:pointer;text-align:left;}button:hover{border-color:#fac213;}#res{margin-top:1rem;font-weight:bold;min-height:2rem;}</style><h2>¿Límite máximo en vías urbanas de Armenia?</h2><button onclick="ok(this,false)">80 km/h</button><button onclick="ok(this,false)">60 km/h</button><button onclick="ok(this,true)">50 km/h</button><button onclick="ok(this,false)">30 km/h</button><div id="res"></div><script>function ok(b,c){document.querySelectorAll("button").forEach(x=>x.disabled=true);b.style.borderColor=c?"#22c55e":"#ef4444";document.getElementById("res").innerHTML=c?"<span style=color:#22c55e>✅ ¡Correcto! Ley 2251.</span>":"<span style=color:#ef4444>❌ Incorrecto. Son 50 km/h.</span>";}</script>',
 'fas fa-traffic-light',
 '#fac213');
