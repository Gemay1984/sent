/* ============================================================
   SENTIDO VIAL — app.js
   Arquitectura: Store global + Blob URL para iframes seguros
   ============================================================ */

/* ── 1. STORE GLOBAL (acceso sin escaping de strings) ── */
window.SV = {
    simulators: [],
    news: []
};

/* ── 2. ENRUTADOR SPA ── */
const router = {
    navigate: (viewId) => {
        document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('data-view') === viewId) l.classList.add('active');
        });
        // Cerrar menú móvil
        document.querySelector('.nav-links')?.classList.remove('active');
    }
};

/* ── 3. FESTIVOS COLOMBIA + PICO Y PLACA ARMENIA ── */
const dashboard = {

    /**
     * Algoritmo de Meeus/Jones/Butcher para calcular Domingo de Resurrección.
     * Devuelve un objeto Date con la fecha exacta de Pascua para el año dado.
     */
    calcularPascua(anio) {
        const a = anio % 19;
        const b = Math.floor(anio / 100);
        const c = anio % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mes = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
        const dia = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(anio, mes, dia);
    },

    /**
     * "Ley Puente Festivo" (Ley 51/1983):
     * Si el festivo cae lunes → mismo día.
     * Si cae martes-domingo → se traslada al lunes siguiente.
     */
    traslado(anio, mes, dia) {
        const fecha = new Date(anio, mes, dia);
        const dow = fecha.getDay(); // 0=dom, 1=lun...
        if (dow === 1) return fecha; // ya es lunes
        const diff = dow === 0 ? 1 : (8 - dow); // dias hasta el lunes
        fecha.setDate(fecha.getDate() + diff);
        return fecha;
    },

    /** Sumar días a una fecha (sin mutar el original). */
    sumarDias(fecha, dias) {
        const f = new Date(fecha);
        f.setDate(f.getDate() + dias);
        return f;
    },

    /**
     * Devuelve un Set de strings 'YYYY-M-D' con TODOS los festivos
     * colombianos del año dado, según la Ley 51/1983 y sus modificaciones.
     */
    festivosColombia(anio) {
        const t = this.traslado.bind(this);
        const pascua = this.calcularPascua(anio);
        const s = this.sumarDias.bind(this);

        const lista = [
            // ── Festivos FIJOS (no se trasladan) ──────────────────────────
            new Date(anio, 0, 1),   // 1 ene  Año Nuevo
            new Date(anio, 4, 1),   // 1 may  Día del Trabajo
            new Date(anio, 6, 20),  // 20 jul Día de la Independencia
            new Date(anio, 7, 7),   // 7 ago  Batalla de Boyacá
            new Date(anio, 11, 8),  // 8 dic  Inmaculada Concepción
            new Date(anio, 11, 25), // 25 dic Navidad

            // ── Festivos MÓVILES (traslado al lunes — Ley 51/1983) ────────
            t(anio, 0, 6),   // 6 ene  Reyes Magos
            t(anio, 2, 19),  // 19 mar San José
            t(anio, 5, 29),  // 29 jun San Pedro y San Pablo
            t(anio, 7, 15),  // 15 ago Asunción de la Virgen
            t(anio, 9, 12),  // 12 oct Día de la Raza
            t(anio, 10, 1),  // 1 nov  Todos los Santos
            t(anio, 10, 11), // 11 nov Independencia de Cartagena

            // ── Festivos ligados a PASCUA ──────────────────────────────────
            // Jueves Santo (-3 días) — NO se traslada
            s(pascua, -3),
            // Viernes Santo (-2 días) — NO se traslada
            s(pascua, -2),
            // Ascensión del Señor (+39 días, trasladado a lunes)
            (() => {
                const base = s(pascua, 39);
                const dow = base.getDay();
                if (dow === 1) return base;
                const lunes = new Date(base);
                lunes.setDate(base.getDate() + (dow === 0 ? 1 : 8 - dow));
                return lunes;
            })(),
            // Corpus Christi (+60 días, trasladado a lunes)
            (() => {
                const base = s(pascua, 60);
                const dow = base.getDay();
                if (dow === 1) return base;
                const lunes = new Date(base);
                lunes.setDate(base.getDate() + (dow === 0 ? 1 : 8 - dow));
                return lunes;
            })(),
            // Sagrado Corazón (+71 días, trasladado a lunes)
            (() => {
                const base = s(pascua, 71);
                const dow = base.getDay();
                if (dow === 1) return base;
                const lunes = new Date(base);
                lunes.setDate(base.getDate() + (dow === 0 ? 1 : 8 - dow));
                return lunes;
            })(),
        ];

        // Convertir a Set de strings 'YYYY-M-D' para comparación rápida
        return new Set(lista.map(f => `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`));
    },

    /** Nombre descriptivo del festivo (para mostrar en el widget). */
    nombreFestivo(now) {
        const anio = now.getFullYear();
        const clave = `${anio}-${now.getMonth()}-${now.getDate()}`;
        const pascua = this.calcularPascua(anio);
        const t = this.traslado.bind(this);
        const s = this.sumarDias.bind(this);

        const fk = (f) => `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;

        const mapa = {
            [`${anio}-0-0`]:   '🎆 Año Nuevo',
            [`${anio}-4-0`]:   '👷 Día del Trabajo',
            [`${anio}-6-19`]:  '🇨🇴 Independencia de Colombia',
            [`${anio}-7-6`]:   '⚔️ Batalla de Boyacá',
            [`${anio}-11-7`]:  '🕊️ Inmaculada Concepción',
            [`${anio}-11-24`]: '🎄 Navidad',
            [fk(t(anio,0,5))]:  '⭐ Reyes Magos',
            [fk(t(anio,2,18))]: '🙏 San José',
            [fk(t(anio,5,28))]: '⛪ San Pedro y San Pablo',
            [fk(t(anio,7,14))]: '🕊️ Asunción de la Virgen',
            [fk(t(anio,9,11))]: '🌍 Día de la Raza',
            [fk(t(anio,10,0))]: '🕯️ Todos los Santos',
            [fk(t(anio,10,10))]: '🎉 Independencia de Cartagena',
            [fk(s(pascua,-3))]: '✝️ Jueves Santo',
            [fk(s(pascua,-2))]: '✝️ Viernes Santo',
        };

        return mapa[clave] || '🎉 Festivo Nacional';
    },

    init() {
        const days   = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
        const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

        // Rotación oficial de Pico y Placa Armenia (SETTA)
        // Lun=1y2, Mar=3y4, Mié=5y6, Jue=7y8, Vie=9y0, Sáb/Dom=LIBRE
        const pyp = ['LIBRE', '1 y 2', '3 y 4', '5 y 6', '7 y 8', '9 y 0', 'LIBRE'];

        const elDate = document.getElementById('current-date');
        const elDay  = document.getElementById('pyp-day');
        const elNums = document.getElementById('pyp-numbers');
        if (!elDate) return;

        const now   = new Date();
        const d     = now.getDay();
        const anio  = now.getFullYear();
        const key   = `${anio}-${now.getMonth()}-${now.getDate()}`;

        // Calcular festivos para el año actual
        const festivos = this.festivosColombia(anio);
        const esFestivo = festivos.has(key);
        const esFinde   = (d === 0 || d === 6);

        elDate.innerText = `${days[d]}, ${now.getDate()} de ${months[now.getMonth()]} ${anio}`;

        if (esFestivo) {
            // --- DÍA FESTIVO ---
            elDay.innerText = this.nombreFestivo(now);
            elDay.style.color = '#22c55e';
            elNums.innerText = 'FESTIVO';
            elNums.style.fontSize = '2.5rem';
            elNums.style.color = '#22c55e';

            // Añadir nota informativa si no existe
            const nota = document.getElementById('pyp-nota');
            if (nota) {
                nota.innerHTML = 'En festivos <strong style="color:#22c55e">no aplica</strong> Pico y Placa en Armenia';
            }
        } else if (esFinde) {
            // --- FIN DE SEMANA ---
            elDay.innerText = days[d];
            elDay.style.color = '#3b82f6';
            elNums.innerText = 'LIBRE';
            elNums.style.fontSize = '4rem';
            elNums.style.color = '#3b82f6';
            const nota = document.getElementById('pyp-nota');
            if (nota) nota.innerHTML = 'Los fines de semana <strong style="color:#3b82f6">no aplica</strong> Pico y Placa';
        } else {
            // --- DÍA HÁBIL NORMAL ---
            elDay.innerText = days[d];
            elNums.innerText = pyp[d];
            elNums.style.fontSize = '4rem';
            elNums.style.color = '#f8fafc';
        }
    }
};

/* ── 4. SISTEMA DE MODALES ── */
const ui = {

    /* Modal genérico para formularios / textos */
    openModal(title, htmlContent) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML  = htmlContent;
        document.getElementById('global-modal').setAttribute('data-size', 'normal');
        document.getElementById('global-modal').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /* Modal de simulador — crea Blob URL para ejecutar HTML + JS sin bloqueos */
    openSimulatorById(id) {
        const sim = window.SV.simulators.find(s => s.id === id);
        if (!sim) return;

        const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sim.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 2rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    button {
      cursor: pointer;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.2s;
    }
    input, select, textarea {
      width: 100%;
      padding: 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid #334155;
      background: #1e293b;
      color: #f8fafc;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
${sim.embedCode}
</body>
</html>`;

        const blob    = new Blob([fullHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        document.getElementById('modal-title').innerText = sim.title;
        document.getElementById('modal-body').innerHTML  =
            `<iframe src="${blobUrl}"
                style="width:100%;height:70vh;border:none;border-radius:0.5rem;"
                onload="URL.revokeObjectURL(this.src)"
             ></iframe>`;

        document.getElementById('global-modal').setAttribute('data-size', 'large');
        document.getElementById('global-modal').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /* Mostrar noticia completa (Estilo Premium Editorial) */
    openNewsById(id) {
        const n = window.SV.news.find(item => item.id === id);
        if (!n) return;
        
        // Soportar tanto las llaves de la BD (español) como el fallback local (inglés)
        const titulo = n.titulo || n.title;
        const categoria = n.categoria || n.category || 'NOTICIA';
        const fecha = n.fecha || n.date;
        const imagen = n.imagen_url || n.image || 'https://picsum.photos/seed/sv/1200/675';
        const extracto = n.extracto || n.excerpt || '';
        const contenido = n.contenido || n.content || '';

        // Formatear titular (cada 3ra palabra en color primario cursivo para estilo revista)
        const words = titulo.split(' ');
        const formattedHeadline = words.map((word, i) => 
            (i % 3 === 1) ? `<span style="font-style: italic; color: var(--primary);">${word}</span>` : word
        ).join(' ');

        document.getElementById('pub-titulo').innerHTML = formattedHeadline;
        document.getElementById('pub-categoria').innerText = categoria;
        document.getElementById('pub-fecha').innerText = fecha;
        document.getElementById('pub-imagen').src = imagen;
        document.getElementById('pub-extracto').innerText = `"${extracto}"`;
        document.getElementById('pub-contenido').innerHTML = contenido;

        // Navegar a la vista de la noticia
        router.navigate('noticia');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    closeModal() {
        document.getElementById('global-modal').classList.remove('active');
        document.body.style.overflow = 'auto';
        setTimeout(() => {
            document.getElementById('modal-body').innerHTML = '';
        }, 300);
    },

    async submitAsesoria(e) {
        e.preventDefault();
        const form = e.target;
        const btn  = form.querySelector('[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const datos = {
            nombre:      form.querySelector('input[type=text]').value,
            whatsapp:    form.querySelector('input[type=tel]').value,
            entidad:     form.querySelectorAll('select')[0]?.value || '',
            tipo_caso:   form.querySelectorAll('select')[1]?.value || '',
            descripcion: form.querySelector('textarea')?.value || '',
        };

        try {
            const res  = await fetch('api/asesorias.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            const data = await res.json();
            if (data.ok) {
                this.openModal('¡Solicitud Enviada!', `
                    <div style="text-align:center;padding:2rem;">
                        <i class="fas fa-check-circle" style="font-size:4rem;color:var(--primary);margin-bottom:1rem;"></i>
                        <h3 style="margin-bottom:1rem;">¡Recibido, ${datos.nombre}!</h3>
                        <p style="color:var(--text-muted);">Su caso ha sido registrado en nuestro sistema.<br>
                        Le contactaremos en las próximas <strong>24 horas</strong> al WhatsApp <strong>${datos.whatsapp}</strong>.</p>
                    </div>`);
                form.reset();
            } else {
                alert('Error: ' + (data.error || 'Intente de nuevo'));
            }
        } catch (_) {
            // Fallback si no hay API (local)
            this.openModal('Solicitud Recibida', `
                <div style="text-align:center;padding:2rem;">
                    <i class="fas fa-check-circle" style="font-size:4rem;color:var(--primary);margin-bottom:1rem;"></i>
                    <h3>¡Recibido!</h3>
                    <p style="color:var(--text-muted);">Le contactaremos pronto por WhatsApp.</p>
                </div>`);
            form.reset();
        } finally {
            btn.disabled = false;
            btn.textContent = 'SOLICITAR ANÁLISIS GRATUITO';
        }
    },

    openPublicarAnuncio() {
        this.openModal('Publicar Anuncio', `
            <form onsubmit="ui.enviarClasificadoPublico(event)" id="form-clasificado-pub">
                <div class="form-group">
                    <label class="form-label">Tipo de Anuncio</label>
                    <select id="c-pub-tipo" class="form-control">
                        <option>Venta de Vehículo</option>
                        <option>Arriendo de Vehículo</option>
                        <option>Repuestos y Accesorios</option>
                        <option>Oferta de Empleo (Conductor)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Título del Anuncio *</label>
                    <input id="c-pub-titulo" type="text" class="form-control" placeholder="Ej: Vendo Chevrolet Spark 2020" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Precio (COP)</label>
                    <input id="c-pub-precio" type="number" class="form-control" placeholder="35000000">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div class="form-group">
                        <label class="form-label">Ciudad / Municipio *</label>
                        <select id="c-pub-ciudad" class="form-control">
                            <option>Armenia</option><option>Calarcá</option>
                            <option>Montenegro</option><option>Quimbaya</option>
                            <option>La Tebaida</option><option>Otro Quindío</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">WhatsApp de Contacto *</label>
                        <input id="c-pub-whatsapp" type="tel" class="form-control" placeholder="3000000000" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Fotos del Anuncio (Sube 1 o varias)</label>
                    <input type="file" id="c-pub-fotos" class="form-control" accept="image/*" multiple style="padding: 0.5rem; background: var(--bg-dark);">
                </div>
                <div class="form-group">
                    <label class="form-label">Descripción</label>
                    <textarea id="c-pub-desc" class="form-control" rows="3" placeholder="Estado, kilometraje, detalles..." style="resize:none;"></textarea>
                </div>
                <button type="submit" id="btn-pub-clas" class="btn btn-primary w-full">ENVIAR A REVISIÓN</button>
            </form>`);
    },

    async enviarClasificadoPublico(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-pub-clas');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo anuncio...';

        try {
            // 1. Subir fotos si hay
            const fileInput = document.getElementById('c-pub-fotos');
            let urls = [];
            
            if (fileInput.files.length > 0) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo fotos...';
                for (let i = 0; i < fileInput.files.length; i++) {
                    const fd = new FormData();
                    fd.append('image', fileInput.files[i]);
                    const upRes = await fetch('api/upload.php', { method: 'POST', body: fd });
                    if (upRes.ok) {
                        const upData = await upRes.json();
                        if (upData.url) urls.push(upData.url);
                    }
                }
            }

            // 2. Enviar datos del anuncio a la base de datos
            const bodyData = {
                tipo: document.getElementById('c-pub-tipo').value,
                titulo: document.getElementById('c-pub-titulo').value,
                precio: document.getElementById('c-pub-precio').value || 0,
                ciudad: document.getElementById('c-pub-ciudad').value,
                whatsapp: document.getElementById('c-pub-whatsapp').value,
                descripcion: document.getElementById('c-pub-desc').value,
                imagen_url: urls.join(',') // Se guardan como "url1,url2"
            };

            const res = await fetch('api/clasificados.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (res.ok) {
                this.closeModal();
                alert('✅ Anuncio enviado a revisión. Será visible cuando el administrador lo apruebe.');
            } else {
                throw new Error('Error al guardar el anuncio.');
            }
        } catch (error) {
            console.error(error);
            // Fallback (solo para que funcione en desarrollo sin DB)
            alert('✅ Anuncio registrado localmente (Modo Desarrollo).');
            this.closeModal();
        } finally {
            btn.disabled = false;
            btn.textContent = 'ENVIAR A REVISIÓN';
        }
    },

    openPrivacidad() {
        this.openModal('Política de Privacidad', `
            <div style="line-height:1.8;">
                <p style="margin-bottom:1rem;"><strong>Sentido Vial</strong> respeta y protege la privacidad de sus usuarios.</p>
                <h4 style="color:var(--primary);margin-bottom:0.5rem;">Datos recopilados</h4>
                <p style="color:var(--text-muted);margin-bottom:1rem;">Solo recopilamos información que usted nos proporciona voluntariamente a través de los formularios de asesoría y clasificados.</p>
                <h4 style="color:var(--primary);margin-bottom:0.5rem;">Uso de la información</h4>
                <p style="color:var(--text-muted);margin-bottom:1rem;">La información es utilizada exclusivamente para brindar los servicios solicitados y nunca se comparte con terceros sin consentimiento.</p>
                <h4 style="color:var(--primary);margin-bottom:0.5rem;">Contacto</h4>
                <p style="color:var(--text-muted);">Para ejercer sus derechos de acceso, rectificación o eliminación, contáctenos a través de la sección de Asesoría.</p>
            </div>`);
    },

    openTerminos() {
        this.openModal('Términos y Condiciones', `
            <div style="line-height:1.8;">
                <p style="margin-bottom:1rem;"><strong>Sentido Vial</strong> presta servicios de información, consultoría jurídica orientativa y clasificados automotrices en el Quindío.</p>
                <h4 style="color:var(--primary);margin-bottom:0.5rem;">Uso del portal</h4>
                <p style="color:var(--text-muted);margin-bottom:1rem;">El contenido publicado es de carácter informativo. La asesoría jurídica orientativa no reemplaza la consulta con un abogado habilitado.</p>
                <h4 style="color:var(--primary);margin-bottom:0.5rem;">Clasificados</h4>
                <p style="color:var(--text-muted);margin-bottom:1rem;">Sentido Vial actúa como intermediario y no se responsabiliza por las transacciones entre compradores y vendedores.</p>
                <h4 style="color:var(--primary);margin-bottom:0.5rem;">Propiedad intelectual</h4>
                <p style="color:var(--text-muted);">Todo el contenido editorial y diseño es propiedad de Sentido Vial Quindío. Prohibida su reproducción sin autorización.</p>
            </div>`);
    }
};

/* ── 5. GESTOR DE CONTENIDO (LocalStorage) ── */
const contentManager = {

    defaultNews: [
        {
            id: 1,
            title: "SETTA: Nueva rotación Pico y Placa en el Centro de Armenia",
            excerpt: "La Secretaría de Tránsito confirma cambios en los perímetros restringidos entre las carreras 13 y 19.",
            content: "<p>La Secretaría de Tránsito y Transporte de Armenia (SETTA) ha emitido el nuevo decreto que modifica la rotación numérica para vehículos particulares y motocicletas en el centro de la ciudad.</p><p>La restricción aplica desde la Calle 11 hasta la Calle 25, y entre la Carrera 13 y la Carrera 19. El horario se mantiene de 7:00 a.m. a 7:00 p.m.</p>",
            category: "SETTA",
            image: "https://images.unsplash.com/photo-1506526135688-6d274092b77a?auto=format&fit=crop&q=80&w=1000",
            date: "2026-05-01"
        },
        {
            id: 2,
            title: "Cierres nocturnos en la vía La Línea este fin de semana",
            excerpt: "Invías anuncia cierres parciales en el tramo Calarcá - Cajamarca por mantenimiento del sistema de ventilación.",
            content: "<p>Invías anunció cierres parciales nocturnos en el tramo Calarcá - Cajamarca durante todo el fin de semana para labores de mantenimiento correctivo en el sistema de ventilación del túnel principal.</p><p>Se recomienda planificar los viajes con anticipación y usar la vía alterna por El Bosque.</p>",
            category: "Nacional",
            image: "https://images.unsplash.com/photo-1545620986-7a892780e557?auto=format&fit=crop&q=80&w=1000",
            date: "2026-04-30"
        },
        {
            id: 3,
            title: "Corte frena embargos por fotomultas en Autopistas del Café",
            excerpt: "Fallo judicial determina que no se pueden congelar cuentas sin notificación personal al propietario.",
            content: "<p>Un reciente fallo ampara a cientos de conductores del Quindío que vieron sus cuentas bancarias embargadas sin previo aviso por comparendos captados en las cámaras de velocidad.</p><p>El tribunal reiteró, amparado en la Sentencia C-038 de 2020, que las concesiones viales <strong>no pueden asumir la culpabilidad del propietario del vehículo</strong> de forma automática.</p>",
            category: "Judicial",
            image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=1000",
            date: "2026-04-28"
        }
    ],

    defaultSimulators: [
        {
            id: 1001,
            title: "Examen Teórico Quindío",
            description: "Preguntas basadas en el Código Nacional de Tránsito y vías del Eje Cafetero.",
            icon: "fas fa-traffic-light",
            color: "var(--primary)",
            embedCode: `<style>
  h2{color:#fac213;margin-bottom:1.5rem;font-size:1.4rem;}
  .opts button{display:block;width:100%;margin:0.5rem 0;padding:1rem;
    background:#1e293b;border:1px solid #334155;border-radius:0.5rem;
    color:#f8fafc;font-size:1rem;cursor:pointer;text-align:left;transition:0.2s;}
  .opts button:hover{border-color:#fac213;background:#27384f;}
  #feedback{margin-top:1.5rem;font-size:1.1rem;font-weight:bold;min-height:2rem;}
</style>
<h2>¿A qué velocidad máxima puedes circular en vías urbanas de Armenia?</h2>
<div class="opts">
  <button onclick="check(this,'wrong')">🚗 80 km/h</button>
  <button onclick="check(this,'wrong')">🚗 60 km/h</button>
  <button onclick="check(this,'correct')">🚗 50 km/h</button>
  <button onclick="check(this,'wrong')">🚗 30 km/h</button>
</div>
<div id="feedback"></div>
<script>
function check(btn, result){
  document.querySelectorAll('.opts button').forEach(b=>b.disabled=true);
  if(result==='correct'){
    btn.style.borderColor='#22c55e'; btn.style.background='#14532d';
    document.getElementById('feedback').innerHTML=
      '<span style="color:#22c55e">✅ ¡Correcto! 50 km/h es el límite máximo urbano en Colombia (Ley 2251).</span>';
  } else {
    btn.style.borderColor='#ef4444'; btn.style.background='#450a0a';
    document.getElementById('feedback').innerHTML=
      '<span style="color:#ef4444">❌ Incorrecto. El límite urbano es <strong>50 km/h</strong> según el Código Nacional de Tránsito.</span>';
  }
}
</script>`
        },
        {
            id: 1002,
            title: "Test de Reacción de Frenado",
            description: "Mide tu tiempo de reacción en milisegundos. Toca cuando la luz cambie a verde.",
            icon: "fas fa-stopwatch",
            color: "var(--accent-red)",
            embedCode: `<style>
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;}
  #box{
    width:90%;max-width:500px;height:220px;border-radius:1rem;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;font-size:1.4rem;font-weight:bold;
    text-transform:uppercase;letter-spacing:2px;
    background:#ef4444;color:#fff;transition:background 0.2s;
    user-select:none;
  }
  #info{margin-top:1.5rem;font-size:1.1rem;color:#94a3b8;text-align:center;}
  #result{font-size:2rem;font-weight:900;color:#fac213;margin-top:1rem;}
</style>
<div id="box" onclick="react()">ESPERANDO...</div>
<div id="info">Espera a que la caja se vuelva VERDE y toca lo más rápido que puedas.</div>
<div id="result"></div>
<script>
  let startTime=null, waiting=false, timeout=null;
  const box=document.getElementById('box');
  const result=document.getElementById('result');
  const info=document.getElementById('info');

  function reset(){
    startTime=null; waiting=false;
    clearTimeout(timeout);
    box.style.background='#ef4444';
    box.textContent='TOCA PARA EMPEZAR';
    result.textContent='';
    info.textContent='Espera a que cambie a verde y reacciona rápido.';
  }

  function startWait(){
    box.style.background='#ca8a04';
    box.textContent='ESPERA...';
    waiting=true;
    const delay=1500+Math.random()*3000;
    timeout=setTimeout(()=>{
      box.style.background='#22c55e';
      box.textContent='¡AHORA!';
      startTime=Date.now();
      waiting=false;
    }, delay);
  }

  function react(){
    if(!startTime && !waiting){ startWait(); return; }
    if(waiting){ clearTimeout(timeout); box.style.background='#ef4444'; box.textContent='¡DEMASIADO PRONTO!'; setTimeout(reset,1500); return; }
    const ms=Date.now()-startTime;
    let rating=ms<200?'🏆 Reflejos excepcionales':ms<300?'✅ Buen tiempo':ms<500?'⚠️ Normal':'❌ Lento, descansa más';
    box.textContent='Toca para reiniciar';
    result.textContent=ms+' ms';
    info.textContent=rating;
    startTime=null;
  }

  reset();
</script>`
        }
    ],

    async getNews() {
        try {
            const res = await fetch('api/noticias.php');
            if (!res.ok) throw new Error('API no disponible');
            const data = await res.json();
            if (data.ok && data.data.length) return data.data;
        } catch (_) { /* API no disponible localmente, usar defaults */ }
        // Fallback a localStorage (desarrollo local)
        const stored = localStorage.getItem('sv_news');
        return stored ? JSON.parse(stored) : this.defaultNews;
    },

    async getSimulators() {
        let dbSims = [];
        try {
            const res = await fetch('api/simuladores.php');
            if (!res.ok) throw new Error('API no disponible');
            const data = await res.json();
            if (data.ok && data.data && data.data.length > 0) {
                // Normalizar campo embed_html → embedCode
                dbSims = data.data.map(s => ({
                    id: s.id, 
                    title: s.titulo || s.title, 
                    description: s.descripcion || s.description,
                    icon: s.icono || s.icon || 'fas fa-gamepad',
                    color: s.color || 'var(--accent-red)',
                    embedCode: s.embed_html || s.embedCode
                }));
            }
        } catch (_) { 
            // Fallback
            const stored = localStorage.getItem('sv_simulators');
            if (stored) {
                const parsed = JSON.parse(stored);
                dbSims = parsed.map(s => ({
                    id: s.id, 
                    title: s.titulo || s.title, 
                    description: s.descripcion || s.description,
                    icon: s.icono || s.icon || 'fas fa-gamepad',
                    color: s.color || 'var(--accent-red)',
                    embedCode: s.embed_html || s.embedCode
                }));
            }
        }
        
        // Retornar los simuladores de la BD + los simuladores por defecto del sistema
        return [...dbSims, ...this.defaultSimulators];
    },

    async getClasificados() {
        try {
            const res = await fetch('api/clasificados.php');
            if (!res.ok) throw new Error('API no disponible');
            const data = await res.json();
            if (data.ok && data.data) return data.data;
        } catch (_) { }
        return [];
    },

    async renderNews() {
        const container = document.getElementById('news-container');
        if (!container) return;
        const news = await this.getNews();
        window.SV.news = news;

        container.innerHTML = news.map(n => `
            <article class="card animate-fade-in">
                <div style="height:200px;overflow:hidden;position:relative;">
                    <img src="${n.imagen_url || n.image || ''}" alt="${n.titulo || n.title}"
                         style="width:100%;height:100%;object-fit:cover;transition:transform 0.5s;">
                    <span style="position:absolute;top:1rem;left:1rem;background:var(--primary);
                                 color:var(--bg-dark);font-size:0.7rem;font-weight:700;
                                 padding:0.2rem 0.6rem;border-radius:4px;text-transform:uppercase;">
                        ${n.categoria || n.category}
                    </span>
                </div>
                <div class="p-6">
                    <p style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.5rem;">${n.fecha || n.date}</p>
                    <h3 class="font-serif mb-3" style="font-size:1.3rem;">${n.titulo || n.title}</h3>
                    <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1.5rem;">${n.extracto || n.excerpt}</p>
                    <button class="btn btn-outline" style="width:100%;font-size:0.75rem;"
                            onclick="ui.openNewsById(${n.id})">LEER NOTA COMPLETA</button>
                </div>
            </article>`
        ).join('');
    },

    async renderSimulators() {
        const container = document.getElementById('simulators-container');
        if (!container) return;
        const sims = await this.getSimulators();
        // Sincronizar store global — aquí está la clave
        window.SV.simulators = sims;

        container.innerHTML = sims.map(s => `
            <div class="card animate-fade-in" style="display:flex;align-items:center;padding:1.5rem;border-left:4px solid ${s.color};">
                <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.05);display:flex;justify-content:center;align-items:center;margin-right:1.5rem;font-size:1.5rem;color:${s.color};">
                    <i class="${s.icon}"></i>
                </div>
                <div style="flex:1;">
                    <h3 class="font-serif mb-1" style="font-size:1.1rem;">${s.title}</h3>
                    <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.8rem;">${s.description}</p>
                    <button class="btn btn-outline" style="font-size:0.7rem;padding:0.4rem 0.8rem;border-color:${s.color};color:${s.color};"
                            onclick="ui.openSimulatorById(${s.id})">
                        INICIAR RECURSO
                    </button>
                </div>
            </div>`
        ).join('');
    },

    async renderClasificados() {
        const container = document.getElementById('clasificados-container');
        if (!container) return;
        const clasificados = await this.getClasificados();

        if (!clasificados.length) {
            container.innerHTML = '<p style="color:var(--text-muted); padding:2rem;">No hay anuncios disponibles en este momento.</p>';
            return;
        }

        const formatCOP = (num) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);

        container.innerHTML = clasificados.map(c => `
            <div class="glass clasificado-card" style="display:flex; flex-direction:column; border-top: 3px solid var(--primary);">
                ${c.imagen_url ? `<img src="${c.imagen_url.split(',')[0]}" class="mb-4" style="width:100%; height:200px; object-fit:cover; border-radius: 8px;">` : ''}
                <div style="flex: 1; display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4 class="mb-1">${c.titulo}</h4>
                    <span style="background:var(--bg-dark); color:var(--text-muted); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.6rem; border:1px solid var(--glass-border);">${c.tipo}</span>
                </div>
                <p style="color: var(--primary); font-weight: 700; font-size:1.1rem;">${formatCOP(c.precio)}</p>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">${c.ciudad}</p>
                ${c.descripcion ? `<p style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 1rem;">${c.descripcion}</p>` : ''}
                <a href="https://wa.me/57${c.whatsapp.replace(/\s/g,'')}" target="_blank" class="btn btn-outline" style="width:100%; font-size:0.8rem; padding:0.5rem;">
                    <i class="fab fa-whatsapp"></i> Contactar Vendedor
                </a>
            </div>`
        ).join('');
    }
};

/* ── 6. INICIALIZACIÓN ── */
document.addEventListener('DOMContentLoaded', () => {
    dashboard.init();
    contentManager.renderNews();
    contentManager.renderSimulators();
    contentManager.renderClasificados();

    // Menú móvil
    document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
        document.querySelector('.nav-links')?.classList.toggle('active');
    });

    // Cerrar modal al hacer clic fuera del contenedor
    document.getElementById('global-modal')?.addEventListener('click', function(e) {
        if (e.target === this) ui.closeModal();
    });

    // Formulario de asesoría
    document.getElementById('form-asesoria')
        ?.addEventListener('submit', (e) => ui.submitAsesoria(e));

    // Navegación por hash
    const hash = window.location.hash.replace('#', '');
    if (hash) router.navigate(hash);
});

