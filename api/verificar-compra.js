import { google } from 'googleapis';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido' });
    }

    try {
        const { items, metodoEnvio, cliente } = req.body;

        // Configurar credenciales de Google Sheets usando variables de entorno
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

        // Leer datos de la "Hoja 2" (Rango A:G completo)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Hoja 2!A:G',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error("No se encontraron datos en la Hoja 2.");
        }

        // Analizar cada ítem enviado por el carrito
        for (const item of items) {
            // Buscamos coincidencia exacta de Nombre (Columna A) y Color/Variante (Columna B)
            const filaProducto = rows.find(row => 
                row[0]?.trim().toLowerCase() === item.nombre?.trim().toLowerCase() &&
                row[1]?.trim().toLowerCase() === item.variante?.trim().toLowerCase()
            );

            if (!filaProducto) {
                return res.status(400).json({ 
                    message: `El producto o la variante "${item.nombre} (${item.variante})" no se encuentra en el inventario.` 
                });
            }

            // Según el nuevo orden: Columna D es cantidad, Columna E es Estado, Columna G es DISPONIBLES
            const estado = filaProducto[4]?.trim().toLowerCase(); // Columna E (Índice 4)
            const disponibles = parseInt(filaProducto[6]) || 0;    // Columna G (Índice 6)

            if (estado !== 'disponible' || disponibles <= 0) {
                return res.status(400).json({ 
                    message: `Lo sentimos, "${item.nombre} (${item.variante})" se encuentra agotado actualmente.` 
                });
            }
        }

        // Si todo está correcto y hay stock, generamos el código único de pedido
        const codigoPedido = `MB-${Math.floor(100000 + Math.random() * 900000)}`;

        // Cálculos de montos por contingencia (Subtotal y totales reales)
        // Puedes enriquecer este cálculo si integras precios dinámicos desde la hoja
        let subtotal = 0;
        // Simulación o mapeo estándar local
        subtotal = items.length * 5000; // Valor base ilustrativo por planta en backend

        let costoEnvio = 1500;
        if (metodoEnvio.includes('Metro') && subtotal >= 15000) costoEnvio = 0;
        if (metodoEnvio.includes('Domicilio')) costoEnvio = 3500;
        if (metodoEnvio.includes('Sucursal')) costoEnvio = 0;

        const totalFinal = subtotal + costoEnvio;

        return res.status(200).json({
            codigoPedido,
            subtotal,
            costoEnvio,
            totalFinal
        });

    } catch (error) {
        console.error("Error en API Serverless:", error);
        return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
}
