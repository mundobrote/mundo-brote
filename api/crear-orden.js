// api/crear-orden.js - Servidor Seguro de Mundo Brote

// 1. LISTA DE PRECIOS OFICIAL E INMUTABLE (El servidor manda)
const CATALOGO_OFICIAL = {
    // SUCULENTAS
    "rosario": 4000,
    "ceropegia": 4000,
    "shrek": 3000,
    "rubi": 6000,
    "sedum tokio": 3000,

    // INTERIOR
    "ficus danielle": 7000,
    "ficus hawaiano": 7000,
    "tradescantia zebrina": 6500,
    "tradescantia fluminensis": 7000,
    "plumoso": 4500,
    "cucharita": 6500,
    "pink lady": 4500,
    "singonio verde": 5500,
    "singonio variegado albo": 10000,
    "incienso": 2000,
    "dolar blanco": 3500,
    "helecho": 4500,
    "monalisa": 4500,

    // FLORES
    "cinerarias": 2000,
    "clavelinos": 1200,
    "violeta persia": 7000,
    "ranunculos": 4000,
    "primaveras": 3000,
    "calendulas": 1000,
    "orejas de oso": 1200,
    "margarita africana": 4500,
    "gazanio": 1000,
    "agerantemo": 4500,
    "leptospermum": 5500,

    // EXTERIOR
    "coprosma cobre": 4000,
    "repollo ornamental": 1000,
    "ligustrinas": 2000,
    "hiedra colgante": 6500,
    "ruda": 4000
};

// Función auxiliar para limpiar texto y encontrar la planta
function limpiarNombre(str) {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .trim();
}

export default async function handler(req, res) {
    // Permitir llamadas desde el navegador (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    }

    try {
        const { items, metodoEnvio } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío.' });
        }

        let subtotalCalculado = 0;
        let detalleProductosValidados = [];

        // 2. RECALCULAR PRECIOS DE FORMA SEGURA
        for (const item of items) {
            const nombreLimpio = limpiarNombre(item.nombre);
            
            // Buscar coincidencia en el catálogo oficial
            let precioUnitarioReal = null;
            for (const [clave, precio] of Object.entries(CATALOGO_OFICIAL)) {
                if (nombreLimpio.includes(clave)) {
                    precioUnitarioReal = precio;
                    break;
                }
            }

            if (precioUnitarioReal === null) {
                return res.status(400).json({ error: `Producto no reconocido: ${item.nombre}` });
            }

            const cantidad = parseInt(item.cantidad) || 1;
            const subtotalItem = precioUnitarioReal * cantidad;
            subtotalCalculado += subtotalItem;

            detalleProductosValidados.push({
                nombre: item.nombre,
                cantidad: cantidad,
                precioUnitario: precioUnitarioReal,
                subtotal: subtotalItem
            });
        }

        // 3. CALCULAR COSTO DE ENVÍO SEGURO
        let costoEnvioReal = 0;
        if (metodoEnvio && metodoEnvio.includes('Metro')) {
            costoEnvioReal = (subtotalCalculado >= 15000) ? 0 : 1500;
        } else if (metodoEnvio && metodoEnvio.includes('Domicilio')) {
            costoEnvioReal = 3500;
        } else {
            costoEnvioReal = 0; // Sucursal
        }

        const totalFinalReal = subtotalCalculado + costoEnvioReal;
        const codigoPedido = "MB-" + Math.floor(100000 + Math.random() * 900000);

        // 4. RESPUESTA SEGURA CON MONTOS INALTERABLES
        return res.status(200).json({
            ok: true,
            codigoPedido,
            subtotal: subtotalCalculado,
            costoEnvio: costoEnvioReal,
            totalFinal: totalFinalReal,
            productos: detalleProductosValidados
        });

    } catch (error) {
        console.error("Error en servidor:", error);
        return res.status(500).json({ error: "Error interno del servidor al procesar la orden." });
    }
}
