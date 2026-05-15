/* ============================================================
   SENTIDO VIAL — app.js (Versión SEO Final)
   ============================================================ */

window.SV = { simulators: [], news: [] };

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
    }
};

const ui = {
    openModal(title, htmlContent) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML  = htmlContent;
        document.getElementById('global-modal').classList.add('active');
    },

    async openNewsById(id) {
        let n = window.SV.news.find(item => String(item.id) === String(id));
        if (!n) {
            await contentManager.renderNews();
            n = window.SV.news.find(item => String(item.id) === String(id));
        }
        if (!n) return;

        const titulo = n.titulo || n.title;
        const extracto = n.extracto || n.excerpt;
        const contenido = n.contenido || n.content;
        const categoria = n.categoria || 'NOTICIA';
        
        let imgRaw = n.imagen_url || n.image || '';
        let imgFull = imgRaw.startsWith('http') ? imgRaw : window.location.origin + '/' + imgRaw;

        // URL REAL PARA COMPARTIR (Importante para Facebook/WhatsApp)
        const realUrl = window.location.origin + '/noticia/' + (n.slug || n.id);
        const shareText = encodeURIComponent(titulo);

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>${titulo}</title>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body{background:#020617;color:#f1f5f9;font-family:Montserrat,sans-serif;margin:0;line-height:1.6}
            .topbar{background:#020617;border-bottom:1px solid #1e293b;padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0}
            .wrap{max-width:800px;margin:0 auto;padding:3rem 2rem}
            .img-box{width:100%;aspect-ratio:16/9;border-radius:1rem;overflow:hidden;margin:2rem 0;background:#0f172a;border:1px solid #1e293b}
            .img-box img{width:100%;height:100%;object-fit:cover}
            h1{font-size:3.5rem;font-weight:900;text-transform:uppercase;line-height:1;margin:1rem 0}
            .share-bar{display:flex;gap:1rem;padding:2rem 0;border-top:1px solid #1e293b;margin-top:2rem;flex-wrap:wrap}
            .share-btn{display:flex;align-items:center;gap:0.5rem;padding:0.8rem 1.2rem;border-radius:0.5rem;color:#fff;text-decoration:none;font-weight:700;font-size:0.85rem}
            .wa{background:#25D366}.fb{background:#1877F2}.tw{background:#000}.link{background:#475569}
            button{background:#1e293b;color:#fff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-weight:700}
        </style></head><body>
        <div class="topbar"><button onclick="window.close()">← VOLVER</button> <span style="font-weight:900;color:#eab308">SENTIDO VIAL</span></div>
        <div class="wrap">
            <span style="background:#eab308;color:#000;padding:4px 10px;font-weight:900;font-size:12px;">${categoria}</span>
            <h1>${titulo}</h1>
            <div class="lead" style="font-size:1.3rem;color:#eab308;margin-bottom:2rem">${extracto}</div>
            <div class="img-box"><img src="${imgFull}"></div>
            <div class="content" style="font-size:1.1rem;color:#cbd5e1">${contenido}</div>
            <div class="share-bar">
                <p style="width:100%;font-size:0.7rem;color:#64748b;font-weight:900;margin-bottom:1rem">COMPARTIR EN REDES:</p>
                <a href="https://wa.me/?text=${shareText}%20${realUrl}" target="_blank" class="share-btn wa"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${realUrl}" target="_blank" class="share-btn fb"><i class="fab fa-facebook"></i> Facebook</a>
                <a href="https://twitter.com/intent/tweet?url=${realUrl}&text=${shareText}" target="_blank" class="share-btn tw"><i class="fab fa-x-twitter"></i> Twitter</a>
                <a href="javascript:void(0)" onclick="navigator.clipboard.writeText('${realUrl}');alert('Copiado')" class="share-btn link"><i class="fas fa-link"></i> Copiar</a>
            </div>
        </div></body></html>`;

        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        window.open(URL.createObjectURL(blob), '_blank');
    },

    closeModal() {
        document.getElementById('global-modal').classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

const contentManager = {
    async renderNews() {
        try {
            const res = await fetch('api/noticias.php?v=' + Date.now());
            const data = await res.json();
            if (data.ok) {
                window.SV.news = data.data;
                const container = document.getElementById('news-container');
                if (container) {
                    container.innerHTML = data.data.map(n => `
                    <article class="card">
                        <img src="${n.imagen_url}" style="width:100%;height:220px;object-fit:cover;">
                        <div class="p-6">
                            <h3>${n.titulo}</h3>
                            <button class="btn btn-primary w-full" onclick="ui.openNewsById(${n.id})">LEER NOTA COMPLETA</button>
                        </div>
                    </article>`).join('');
                }
                // Detectar si venimos de un enlace compartido
                const pendingId = sessionStorage.getItem('pending_news_id');
                if (pendingId) {
                    sessionStorage.removeItem('pending_news_id');
                    ui.openNewsById(pendingId);
                }
            }
        } catch (e) { }
    }
};

document.addEventListener('DOMContentLoaded', () => { contentManager.renderNews(); });
