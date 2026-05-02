/* ================================================================
   admin.js — Panel Administrativo Sentido Vial
   Backend: Hostinger MySQL via PHP API
   IA: Google Gemini (proxy seguro via /api/ia.php)
   ================================================================ */

// ── Token de autenticación admin (SHA-256 de 'vial2026_admin_token_secreto')
const ADMIN_TOKEN = ''; // Se calcula al iniciar sesión

const admin = {
    token: null,

    init() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }
    },

    // ── Generar token igual que PHP: sha256('vial2026_admin_token_secreto')
    async hashToken(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    },

    async login() {
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        if (user === 'admin' && pass === 'vial2026') {
            this.token = await this.hashToken('vial2026_admin_token_secreto');
            this.showDashboard();
        } else {
            alert('❌ Credenciales incorrectas. Use: admin / vial2026');
        }
    },

    // ── Llamada genérica a la API PHP con Fallback Local ────────────
    async api(endpoint, method = 'GET', body = null) {
        try {
            const opts = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': this.token || ''
                }
            };
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(`api/${endpoint}`, opts);
            if (!res.ok) throw new Error('API falló');
            return await res.json();
        } catch (e) {
            console.warn('⚠️ No se detectó servidor PHP. Usando almacenamiento local (Fallback).');
            return this.localApiFallback(endpoint, method, body);
        }
    },

    // ── Fallback para cuando se usa el HTML sin servidor (Local) ──
    async localApiFallback(endpoint, method, body) {
        return new Promise(resolve => {
            setTimeout(() => {
                let data = [];
                let key = '';
                
                if (endpoint.includes('noticias')) key = 'sv_news';
                else if (endpoint.includes('simuladores')) key = 'sv_simulators';
                else if (endpoint.includes('clasificados')) key = 'sv_clasificados';
                else return resolve({ ok: true, data: [] });

                data = JSON.parse(localStorage.getItem(key) || '[]');

                if (method === 'GET') {
                    return resolve({ ok: true, data: data });
                }
                
                if (method === 'POST' && !endpoint.includes('accion=')) {
                    if (body && body.id) {
                        // UPDATE
                        const index = data.findIndex(i => i.id === body.id);
                        if (index !== -1) data[index] = { ...data[index], ...body };
                    } else if (body) {
                        // INSERT
                        body.id = Date.now();
                        data.unshift(body);
                    }
                    localStorage.setItem(key, JSON.stringify(data));
                    return resolve({ ok: true });
                }

                if (method === 'DELETE' || endpoint.includes('accion=aprobar')) {
                    const idStr = endpoint.split('id=')[1];
                    const id = idStr ? parseInt(idStr) : 0;
                    if (method === 'DELETE') {
                        data = data.filter(i => i.id !== id);
                    } else {
                        // Aprobar (clasificados)
                        const item = data.find(i => i.id === id);
                        if (item) item.aprobado = 1;
                    }
                    localStorage.setItem(key, JSON.stringify(data));
                    return resolve({ ok: true });
                }

                resolve({ ok: true });
            }, 300); // Simulamos retraso de red
        });
    },

    // ── Llamar a la IA con fallback directo ──────────────────────
    async llamarIA(prompt, accion = 'noticia') {
        const btn = document.getElementById('btn-ia');
        if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Generando...'; }

        const systemContext = "Eres el redactor jefe del portal 'Sentido Vial Quindío', especializado en tránsito, seguridad vial, SETTA, pico y placa, fotomultas y vías del Eje Cafetero (Armenia, Colombia). Redactas en español colombiano formal y periodístico.";

        const instrucciones = {
            noticia: `${systemContext}\n\nRedacta una noticia completa sobre: "${prompt}"\n\nDevuelve EXACTAMENTE este JSON sin markdown:\n{"titulo":"...","extracto":"máximo 2 líneas","contenido":"HTML con etiquetas <p>","categoria":"SETTA|Movilidad|Nacional|Judicial"}`,
            mejora:  `${systemContext}\n\nMejora este texto periodísticamente: "${prompt}"\n\nDevuelve EXACTAMENTE este JSON sin markdown:\n{"contenido":"HTML mejorado con <p>"}`,
            extracto:`${systemContext}\n\nExtracto de máximo 2 líneas para: "${prompt}"\n\nJSON: {"extracto":"..."}`,
            clasificado:`${systemContext}\n\nDescripción atractiva para este vehículo: "${prompt}"\n\nJSON: {"descripcion":"..."}`
        };

        const instruccion = instrucciones[accion] || prompt;

        try {
            // 1️⃣ Intentar vía PHP proxy (producción en Hostinger)
            const proxyRes = await fetch('api/ia.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token || '' },
                body: JSON.stringify({ prompt, accion }),
                signal: AbortSignal.timeout(5000) // 5s timeout para detectar si no hay servidor
            });
            if (proxyRes.ok) {
                const data = await proxyRes.json();
                if (btn) { btn.disabled = false; btn.innerHTML = '✨ Generar con IA'; }
                return data.data || {};
            }
        } catch (_) {
            // PHP no disponible → usar llamada directa (local / desarrollo)
        }

        try {
            // 2️⃣ Fallback: llamada directa a Gemini desde el navegador
            const GEMINI_KEY = 'AIzaSyAoG5DH0h8ufXKt6nTzmX14fqQM0e6R8u8';
            const MODELOS = [
                'gemini-3.1-flash',
                'gemini-3.0-flash',
                'gemini-3.0-pro',
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash'
            ];

            let rawText = '';
            let ultimoError = '';

            for (const modelo of MODELOS) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_KEY}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: instruccion }] }],
                            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                        })
                    });

                    const gemData = await res.json();

                    // Mostrar error real de la API si lo hay
                    if (gemData.error) {
                        ultimoError = gemData.error.message;
                        console.warn(`Modelo ${modelo} falló:`, gemData.error.message);
                        continue; // probar siguiente modelo
                    }

                    rawText = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (rawText) break; // éxito, salir del loop
                } catch (modelErr) {
                    ultimoError = modelErr.message;
                    continue;
                }
            }

            if (!rawText) {
                alert(`⚠️ Gemini no respondió.\nError: ${ultimoError}\n\nVerifica que la API key sea válida en aistudio.google.com`);
                return {};
            }

            // Parseo robusto del JSON devuelto por Gemini
            const clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

            // Intentar parsear directamente
            try {
                return JSON.parse(clean);
            } catch (_) {
                // Si no es JSON, extraer con regex o devolver el texto como contenido
                const tituloMatch  = clean.match(/"titulo"\s*:\s*"([^"]+)"/);
                const extractoMatch= clean.match(/"extracto"\s*:\s*"([^"]+)"/);
                const contenidoMatch=clean.match(/"contenido"\s*:\s*"([\s\S]+?)(?=",\s*"(?:categoria|extracto)|})/);
                const categoriaMatch=clean.match(/"categoria"\s*:\s*"([^"]+)"/);

                if (tituloMatch) {
                    return {
                        titulo:    tituloMatch[1]    || '',
                        extracto:  extractoMatch?.[1] || '',
                        contenido: contenidoMatch?.[1]?.replace(/\\n/g,'\n').replace(/\\"/g,'"') || `<p>${clean}</p>`,
                        categoria: categoriaMatch?.[1]|| 'Movilidad'
                    };
                }

                // Último recurso: poner el texto crudo en el contenido
                return { contenido: `<p>${rawText.replace(/\n/g,'</p><p>')}</p>` };
            }

        } catch (err) {
            console.error('Error Gemini directo:', err);
            alert(`⚠️ Error de conexión con Gemini.\nDetalle: ${err.message}\n\nAsegúrate de tener Internet activo.`);
            return {};
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '✨ Generar con IA'; }
        }
    },


    // ── DASHBOARD PRINCIPAL ───────────────────────────────────────
    showDashboard() {
        document.getElementById('admin-login-view').classList.add('hidden');
        const dash = document.getElementById('admin-dashboard-view');
        dash.classList.remove('hidden');

        dash.innerHTML = `
        <div class="animate-fade-in">
            <div class="glass p-6" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;">
                <div>
                    <h2 class="font-serif" style="font-size:1.8rem;">Panel de Control</h2>
                    <p style="color:var(--text-muted);font-size:0.8rem;">Sentido Vial Quindío — Backend MySQL</p>
                </div>
                <button class="btn btn-outline" onclick="admin.logout()">
                    <i class="fas fa-sign-out-alt"></i> Salir
                </button>
            </div>

            <!-- Tabs -->
            <div style="display:flex;gap:0.5rem;margin-bottom:2rem;flex-wrap:wrap;">
                <button class="btn btn-primary admin-tab active" onclick="admin.showTab('noticias',this)">
                    <i class="fas fa-newspaper"></i> Noticias
                </button>
                <button class="btn btn-outline admin-tab" onclick="admin.showTab('simuladores',this)">
                    <i class="fas fa-gamepad"></i> Simuladores
                </button>
                <button class="btn btn-outline admin-tab" onclick="admin.showTab('asesorias',this)">
                    <i class="fas fa-gavel"></i> Asesorías
                </button>
                <button class="btn btn-outline admin-tab" onclick="admin.showTab('clasificados',this)">
                    <i class="fas fa-car"></i> Clasificados
                </button>
                <a href="admin/image-studio.html" target="_blank"
                   class="btn btn-outline"
                   style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.6rem 1rem;font-size:0.8rem;border-color:#7c3aed;color:#a78bfa;text-decoration:none;">
                    <i class="fas fa-magic"></i> Image Studio
                </a>
            </div>

            <!-- Contenido de tabs -->
            <div id="tab-noticias"></div>
            <div id="tab-simuladores" class="hidden"></div>
            <div id="tab-asesorias" class="hidden"></div>
            <div id="tab-clasificados" class="hidden"></div>
        </div>`;

        this.showTab('noticias', document.querySelector('.admin-tab'));
    },

    showTab(tab, btn) {
        ['noticias','simuladores','asesorias','clasificados'].forEach(t => {
            document.getElementById(`tab-${t}`)?.classList.add('hidden');
        });
        document.querySelectorAll('.admin-tab').forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-outline');
        });
        document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');

        if (tab === 'noticias')    this.renderNoticias();
        if (tab === 'simuladores') this.renderSimuladores();
        if (tab === 'asesorias')   this.renderAsesorias();
        if (tab === 'clasificados') this.renderClasificadosAdmin();
    },

    logout() {
        this.token = null;
        document.getElementById('admin-dashboard-view').classList.add('hidden');
        document.getElementById('admin-login-view').classList.remove('hidden');
    },

    // ════════════════════════════════════════════════════════════
    //  NOTICIAS
    // ════════════════════════════════════════════════════════════
    async renderNoticias() {
        const container = document.getElementById('tab-noticias');
        container.innerHTML = `
        <div class="glass p-6 mb-6">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h3>Noticias publicadas</h3>
                <button class="btn btn-primary" onclick="admin.formNoticias()">
                    <i class="fas fa-plus"></i> Nueva Noticia
                </button>
            </div>
            <div id="lista-noticias"><p style="color:var(--text-muted)">Cargando...</p></div>
        </div>`;

        const res = await this.api('noticias.php');
        const lista = document.getElementById('lista-noticias');
        if (!res.ok || !res.data.length) {
            lista.innerHTML = '<p style="color:var(--text-muted)">No hay noticias aún.</p>';
            return;
        }
        lista.innerHTML = res.data.map(n => `
            <div class="glass p-4 mb-3" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
                <div style="display:flex;gap:1rem;align-items:center;flex:1;min-width:0;">
                    <img src="${n.imagen_url || 'https://via.placeholder.com/50'}"
                         style="width:50px;height:50px;object-fit:cover;border-radius:6px;flex-shrink:0;">
                    <div style="min-width:0;">
                        <span style="background:var(--primary);color:var(--bg-dark);font-size:0.65rem;
                                     font-weight:700;padding:0.1rem 0.5rem;border-radius:3px;">${n.categoria}</span>
                        <h5 style="margin:0.3rem 0 0;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.titulo}</h5>
                        <p style="font-size:0.7rem;color:var(--text-muted);margin:0;">${n.fecha}</p>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-shrink:0;">
                    <button onclick="admin.editarNoticia(${n.id})"
                            style="background:transparent;border:1px solid #3b82f6;color:#3b82f6;padding:0.4rem 0.6rem;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="admin.eliminarNoticia(${n.id})"
                            style="background:transparent;border:1px solid #ef4444;color:#ef4444;padding:0.4rem 0.6rem;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`).join('');
    },

    async editarNoticia(id) {
        const res = await this.api('noticias.php');
        if (res.ok && res.data) {
            const noticia = res.data.find(n => n.id === id);
            if (noticia) this.formNoticias(noticia);
        } else {
            // Fallback local
            const data = JSON.parse(localStorage.getItem('sv_news') || '[]');
            const noticia = data.find(n => n.id === id);
            if (noticia) this.formNoticias(noticia);
        }
    },

    formNoticias(noticia = null) {
        const isEdit = !!noticia;
        ui.openModal(isEdit ? 'Editar Noticia' : 'Redactar Noticia', `
            <form onsubmit="admin.guardarNoticia(event)" style="display:flex;flex-direction:column;gap:1rem;">
                <input type="hidden" id="n-id" value="${noticia?.id || ''}">

                <!-- Asistente IA -->
                <div class="glass p-4" style="border-left:3px solid var(--primary);">
                    <label class="form-label" style="color:var(--primary);">
                        <i class="fas fa-robot"></i> Asistente IA — Describe el tema
                    </label>
                    <div style="display:flex;gap:0.5rem;">
                        <input id="ia-tema" type="text" class="form-control"
                               placeholder="Ej: SETTA modifica pico y placa en Armenia para junio 2026"
                               style="flex:1;">
                        <button type="button" id="btn-ia" class="btn btn-primary"
                                onclick="admin.generarNoticia()" style="white-space:nowrap;flex-shrink:0;">
                            ✨ Generar con IA
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Título *</label>
                    <input id="n-titulo" type="text" class="form-control" value="${noticia?.titulo || ''}" required>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <select id="n-categoria" class="form-control">
                            <option ${noticia?.categoria==='SETTA'?'selected':''}>SETTA</option>
                            <option ${noticia?.categoria==='Movilidad'?'selected':''}>Movilidad</option>
                            <option ${noticia?.categoria==='Nacional'?'selected':''}>Nacional</option>
                            <option ${noticia?.categoria==='Judicial'?'selected':''}>Judicial</option>
                            <option ${noticia?.categoria==='Clasificados'?'selected':''}>Clasificados</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fecha</label>
                        <input id="n-fecha" type="date" class="form-control"
                               value="${noticia?.fecha || new Date().toISOString().split('T')[0]}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Extracto (resumen visible)</label>
                    <input id="n-extracto" type="text" class="form-control" value="${noticia?.extracto || ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Imagen Principal (URL o Subir Archivo)</label>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <input id="n-imagen" type="url" class="form-control" value="${noticia?.imagen_url || ''}"
                               placeholder="https://... o clic en Subir" style="flex:1;">
                        <button type="button" class="btn btn-outline" style="white-space:nowrap;padding:0.4rem 1rem;"
                                onclick="document.getElementById('n-file').click()">
                            <i class="fas fa-upload"></i> Subir
                        </button>
                        <input type="file" id="n-file" accept="image/*" style="display:none" onchange="admin.subirImagenNoticia(this)">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Contenido HTML *
                        <button type="button" onclick="admin.mejorarTexto()"
                                style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.75rem;margin-left:0.5rem;">
                            ✨ Mejorar con IA
                        </button>
                    </label>
                    <textarea id="n-contenido" class="form-control" rows="6"
                              style="font-family:monospace;font-size:0.82rem;" required>${noticia?.contenido || ''}</textarea>
                </div>

                <button type="submit" id="btn-submit-n" class="btn btn-primary w-full">
                    <i class="fas fa-paper-plane"></i> ${isEdit ? 'GUARDAR CAMBIOS' : 'PUBLICAR NOTICIA'}
                </button>
            </form>`);
    },

    async generarNoticia() {
        const tema = document.getElementById('ia-tema')?.value?.trim();
        if (!tema) { alert('Describe el tema de la noticia primero.'); return; }

        const datos = await this.llamarIA(tema, 'noticia');

        if (datos.titulo)     document.getElementById('n-titulo').value    = datos.titulo;
        if (datos.extracto)   document.getElementById('n-extracto').value  = datos.extracto;
        if (datos.contenido)  document.getElementById('n-contenido').value = datos.contenido;
        if (datos.categoria) {
            const sel = document.getElementById('n-categoria');
            [...sel.options].forEach(o => { if (o.value === datos.categoria) o.selected = true; });
        }
    },

    async mejorarTexto() {
        const texto = document.getElementById('n-contenido')?.value?.trim();
        if (!texto) { alert('Escribe algo primero para mejorar.'); return; }
        const datos = await this.llamarIA(texto, 'mejora');
        if (datos.contenido) document.getElementById('n-contenido').value = datos.contenido;
    },

    async guardarNoticia(e) {
        e.preventDefault();
        const btn = e.submitter;
        btn.disabled = true; btn.textContent = 'Guardando...';
        
        const idStr = document.getElementById('n-id').value;
        const bodyData = {
            titulo:    document.getElementById('n-titulo').value,
            extracto:  document.getElementById('n-extracto').value,
            contenido: document.getElementById('n-contenido').value,
            categoria: document.getElementById('n-categoria').value,
            imagen_url:document.getElementById('n-imagen').value,
            fecha:     document.getElementById('n-fecha').value,
        };
        
        if (idStr) bodyData.id = parseInt(idStr);

        const res = await this.api('noticias.php', 'POST', bodyData);
        btn.disabled = false; btn.textContent = idStr ? 'GUARDAR CAMBIOS' : 'PUBLICAR NOTICIA';
        
        if (res.ok) {
            ui.closeModal();
            this.renderNoticias();
            contentManager.renderNews(); // Actualizar vista pública
            alert('✅ Noticia guardada correctamente.');
        } else {
            alert('Error: ' + (res.error || 'Desconocido'));
        }
    },

    async subirImagenNoticia(input) {
        const file = input.files[0];
        if (!file) return;

        const urlInput = document.getElementById('n-imagen');
        urlInput.value = 'Subiendo...';

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('api/upload.php', {
                method: 'POST',
                headers: { 'X-Admin-Token': this.token || '' },
                body: formData
            });
            
            if (res.ok) {
                const data = await res.json();
                urlInput.value = data.url; // Ruta del servidor (ej. api/uploads/...)
            } else {
                throw new Error('Servidor PHP no disponible');
            }
        } catch (e) {
            console.warn('Fallback a Base64 Local por falta de PHP.');
            // Fallback a Base64 local
            const reader = new FileReader();
            reader.onload = ev => {
                // Reducir tamaño un poco si es muy grande no cabrá en localstorage fácilmente
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX = 800;
                    let w = img.width, h = img.height;
                    if (w > MAX) { h *= MAX/w; w = MAX; }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    urlInput.value = canvas.toDataURL('image/jpeg', 0.7);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    },

    async eliminarNoticia(id) {
        if (!confirm('¿Eliminar esta noticia de la base de datos?')) return;
        const res = await this.api(`noticias.php?id=${id}`, 'DELETE');
        if (res.ok) { this.renderNoticias(); contentManager.renderNews(); }
        else alert('Error al eliminar: ' + res.error);
    },

    // ════════════════════════════════════════════════════════════
    //  SIMULADORES
    // ════════════════════════════════════════════════════════════
    async renderSimuladores() {
        const container = document.getElementById('tab-simuladores');
        container.innerHTML = `
        <div class="glass p-6 mb-6">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h3>Recursos educativos</h3>
                <button class="btn btn-primary" onclick="admin.formSimulador()">
                    <i class="fas fa-plus"></i> Nuevo Recurso
                </button>
            </div>
            <div id="lista-sims"><p style="color:var(--text-muted)">Cargando...</p></div>
        </div>`;

        const res = await this.api('simuladores.php');
        const lista = document.getElementById('lista-sims');
        if (!res.ok || !res.data.length) {
            lista.innerHTML = '<p style="color:var(--text-muted)">No hay simuladores aún.</p>';
            return;
        }
        lista.innerHTML = res.data.map(s => `
            <div class="glass p-4 mb-3" style="display:flex;justify-content:space-between;align-items:center;border-left:4px solid ${s.color};">
                <div>
                    <i class="${s.icono}" style="color:${s.color};margin-right:0.5rem;"></i>
                    <strong>${s.titulo}</strong>
                    <p style="font-size:0.8rem;color:var(--text-muted);margin:0.2rem 0 0;">${s.descripcion}</p>
                </div>
                <button onclick="admin.eliminarSimulador(${s.id})"
                        style="background:transparent;border:1px solid #ef4444;color:#ef4444;padding:0.4rem 0.6rem;border-radius:6px;cursor:pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`).join('');
    },

    formSimulador() {
        ui.openModal('Añadir Recurso HTML', `
            <form onsubmit="admin.guardarSimulador(event)" style="display:flex;flex-direction:column;gap:1rem;">
                <div class="form-group">
                    <label class="form-label">Título del Recurso *</label>
                    <input id="s-titulo" type="text" class="form-control" placeholder="Ej: Test de Señales" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Descripción</label>
                    <input id="s-desc" type="text" class="form-control" placeholder="Qué aprenderá el usuario">
                </div>
                <div class="form-group">
                    <label class="form-label" style="color:var(--primary);">
                        ▼ Código HTML + JS del Recurso
                        <span style="font-size:0.7rem;color:var(--text-muted);"> (puede incluir &lt;script&gt;, iframes, Canvas)</span>
                    </label>
                    <textarea id="s-html" class="form-control" rows="10"
                              style="font-family:monospace;font-size:0.82rem;"
                              placeholder="<div>Mi juego...</div>&#10;<script>// JS aquí</script>"
                              required></textarea>
                </div>
                <button type="submit" class="btn btn-primary w-full"
                        style="background:var(--accent-red);color:white;">
                    💾 GUARDAR RECURSO
                </button>
            </form>`);
    },

    async guardarSimulador(e) {
        e.preventDefault();
        const res = await this.api('simuladores.php', 'POST', {
            titulo:     document.getElementById('s-titulo').value,
            descripcion:document.getElementById('s-desc').value,
            embed_html: document.getElementById('s-html').value,
        });
        if (res.ok) {
            ui.closeModal();
            this.renderSimuladores();
            contentManager.renderSimulators();
            alert('✅ Recurso guardado en MySQL.');
        } else alert('Error: ' + res.error);
    },

    async eliminarSimulador(id) {
        if (!confirm('¿Eliminar este simulador?')) return;
        const res = await this.api(`simuladores.php?id=${id}`, 'DELETE');
        if (res.ok) { this.renderSimuladores(); contentManager.renderSimulators(); }
    },

    // ════════════════════════════════════════════════════════════
    //  ASESORÍAS
    // ════════════════════════════════════════════════════════════
    async renderAsesorias() {
        const container = document.getElementById('tab-asesorias');
        container.innerHTML = `
        <div class="glass p-6">
            <h3 style="margin-bottom:1.5rem;">Solicitudes de Asesoría Jurídica</h3>
            <div id="lista-asesorias"><p style="color:var(--text-muted)">Cargando...</p></div>
        </div>`;

        const res = await this.api('asesorias.php');
        const lista = document.getElementById('lista-asesorias');
        if (!res.ok || !res.data.length) {
            lista.innerHTML = '<p style="color:var(--text-muted)">No hay solicitudes aún.</p>';
            return;
        }
        lista.innerHTML = res.data.map(a => `
            <div class="glass p-4 mb-3" style="border-left:4px solid ${a.atendido ? '#22c55e' : 'var(--primary)'};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
                            <strong>${a.nombre}</strong>
                            <span style="background:${a.atendido?'#22c55e':'var(--primary)'};color:var(--bg-dark);
                                         font-size:0.65rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:3px;">
                                ${a.atendido ? '✓ ATENDIDO' : 'PENDIENTE'}
                            </span>
                        </div>
                        <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.3rem;">
                            📱 ${a.whatsapp} &nbsp;|&nbsp; ${a.tipo_caso} &nbsp;|&nbsp; ${a.entidad}
                        </p>
                        <p style="font-size:0.85rem;margin:0;">${a.descripcion}</p>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.5rem;flex-shrink:0;">
                        <a href="https://wa.me/57${a.whatsapp.replace(/\s/g,'')}" target="_blank"
                           class="btn btn-primary" style="font-size:0.75rem;padding:0.4rem 0.8rem;">
                            <i class="fab fa-whatsapp"></i> Contactar
                        </a>
                        ${!a.atendido ? `<button onclick="admin.atenderAsesoria(${a.id})"
                            class="btn btn-outline" style="font-size:0.75rem;padding:0.4rem 0.8rem;">
                            ✓ Marcar atendido
                        </button>` : ''}
                    </div>
                </div>
                <p style="font-size:0.65rem;color:var(--text-muted);margin:0.5rem 0 0;text-align:right;">${a.fecha}</p>
            </div>`).join('');
    },

    async atenderAsesoria(id) {
        const res = await this.api(`asesorias.php?accion=atender&id=${id}`, 'POST');
        if (res.ok) this.renderAsesorias();
    },

    // ════════════════════════════════════════════════════════════
    //  CLASIFICADOS
    // ════════════════════════════════════════════════════════════
    async renderClasificadosAdmin() {
        const container = document.getElementById('tab-clasificados');
        container.innerHTML = `
        <div class="glass p-6">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h3>Anuncios (Mercado Vial)</h3>
                <button class="btn btn-primary" onclick="admin.formClasificado()">
                    <i class="fas fa-plus"></i> Nuevo Anuncio
                </button>
            </div>
            <div id="lista-clasificados-admin"><p style="color:var(--text-muted)">Cargando...</p></div>
        </div>`;

        const res = await this.api('clasificados.php');
        const lista = document.getElementById('lista-clasificados-admin');
        if (!res.ok || !res.data.length) {
            lista.innerHTML = '<p style="color:var(--text-muted)">No hay clasificados aún.</p>';
            return;
        }
        
        const formatCOP = (num) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(num);

        lista.innerHTML = res.data.map(c => `
            <div class="glass p-4 mb-3" style="display:flex; gap:1rem; border-left:4px solid ${c.aprobado ? '#22c55e' : '#ef4444'};">
                ${c.imagen_url ? `<img src="${c.imagen_url.split(',')[0]}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : ''}
                <div style="flex:1; min-width:0;">
                    <div style="display:flex;justify-content:space-between;">
                        <h5 style="margin:0;">${c.titulo} <span style="font-size:0.7rem; color:var(--text-muted);">(${c.tipo})</span></h5>
                        ${!c.aprobado ? `<span style="background:#ef4444; color:white; font-size:0.6rem; padding:0.1rem 0.4rem; border-radius:3px;">PENDIENTE</span>` : ''}
                    </div>
                    <p style="color:var(--primary); margin:0.2rem 0; font-weight:bold;">${formatCOP(c.precio)} - ${c.ciudad}</p>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.descripcion || 'Sin descripción'}</p>
                    <div style="display:flex; gap:0.5rem;">
                        ${!c.aprobado ? `<button class="btn btn-outline" style="font-size:0.7rem; padding:0.3rem 0.6rem; border-color:#22c55e; color:#22c55e;" onclick="admin.aprobarClasificado(${c.id})"><i class="fas fa-check"></i> Aprobar</button>` : ''}
                        <button class="btn btn-outline" style="font-size:0.7rem; padding:0.3rem 0.6rem; border-color:#ef4444; color:#ef4444;" onclick="admin.eliminarClasificado(${c.id})"><i class="fas fa-trash"></i> Eliminar</button>
                    </div>
                </div>
            </div>`).join('');
    },

    async aprobarClasificado(id) {
        const res = await this.api(`clasificados.php?accion=aprobar&id=${id}`, 'POST');
        if (res.ok) {
            this.renderClasificadosAdmin();
            contentManager.renderClasificados();
        }
    },

    async eliminarClasificado(id) {
        if (!confirm('¿Eliminar este clasificado de forma permanente?')) return;
        const res = await this.api(`clasificados.php?id=${id}`, 'DELETE');
        if (res.ok) {
            this.renderClasificadosAdmin();
            contentManager.renderClasificados();
        }
    },

    formClasificado() {
        ui.openModal('Crear Anuncio', `
            <form onsubmit="admin.guardarClasificado(event)" style="display:flex;flex-direction:column;gap:1rem;">
                
                <div class="glass p-4" style="border-left:3px solid var(--primary);">
                    <label class="form-label" style="color:var(--primary);">
                        <i class="fas fa-magic"></i> IA — Describir Vehículo (Ej: Mazda 3 2018 Touring, único dueño, 50mil km)
                    </label>
                    <div style="display:flex;gap:0.5rem;">
                        <input id="ia-vehiculo" type="text" class="form-control" style="flex:1;">
                        <button type="button" id="btn-ia-class" class="btn btn-primary" onclick="admin.generarDescClasificado()" style="white-space:nowrap;">✨ Generar</button>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div class="form-group">
                        <label class="form-label">Tipo</label>
                        <select id="ac-tipo" class="form-control">
                            <option>Venta</option><option>Repuesto</option><option>Empleo</option><option>Arriendo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Título *</label>
                        <input id="ac-titulo" type="text" class="form-control" required>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div class="form-group">
                        <label class="form-label">Precio (COP)</label>
                        <input id="ac-precio" type="number" class="form-control">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ciudad</label>
                        <input id="ac-ciudad" type="text" class="form-control" value="Armenia">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">WhatsApp *</label>
                    <input id="ac-whatsapp" type="tel" class="form-control" required>
                </div>

                <div class="form-group">
                    <label class="form-label">URL Imagen</label>
                    <input id="ac-imagen" type="url" class="form-control">
                </div>

                <div class="form-group">
                    <label class="form-label">Descripción</label>
                    <textarea id="ac-desc" class="form-control" rows="3"></textarea>
                </div>

                <button type="submit" class="btn btn-primary w-full">PUBLICAR (Auto-Aprobado)</button>
            </form>`);
    },

    async generarDescClasificado() {
        const tema = document.getElementById('ia-vehiculo')?.value?.trim();
        if (!tema) return alert('Describe el vehículo primero.');
        const btn = document.getElementById('btn-ia-class');
        btn.disabled = true; btn.textContent = '⏳...';
        
        const datos = await this.llamarIA(tema, 'clasificado');
        if (datos.descripcion) document.getElementById('ac-desc').value = datos.descripcion;
        
        btn.disabled = false; btn.textContent = '✨ Generar';
    },

    async guardarClasificado(e) {
        e.preventDefault();
        const btn = e.submitter;
        btn.disabled = true; btn.textContent = 'Guardando...';
        
        const res = await this.api('clasificados.php', 'POST', {
            tipo: document.getElementById('ac-tipo').value,
            titulo: document.getElementById('ac-titulo').value,
            precio: document.getElementById('ac-precio').value || 0,
            ciudad: document.getElementById('ac-ciudad').value,
            whatsapp: document.getElementById('ac-whatsapp').value,
            imagen_url: document.getElementById('ac-imagen').value,
            descripcion: document.getElementById('ac-desc').value
        });
        
        if (res.ok) {
            ui.closeModal();
            this.renderClasificadosAdmin();
            contentManager.renderClasificados();
        } else {
            alert('Error: ' + res.error);
        }
    }
};

admin.init();
