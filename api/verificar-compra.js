import { google } from 'googleapis';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido' });
    }

    try {
        const { items, metodoEnvio, cliente } = req.body;

        // 1. Configurar credenciales de Google Sheets
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

        // 2. Leer los datos actuales de la "Hoja 2"
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Hoja 2!A:G',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error("No se encontraron datos en la Hoja 2.");
        }

        // Guardaremos las actualizaciones que haremos al final
        const filasAActualizar = [];

        // 3. Verificar stock de cada ítem en el carrito
        for (const item of items) {
            // Buscamos la fila que coincida en Nombre (Columna A) y Color (Columna B)
            const indexFila = rows.findIndex(row => 
                row[0]?.trim().toLowerCase() === item.nombre?.trim().toLowerCase() &&
                row[1]?.trim().toLowerCase() === item.variante?.trim().toLowerCase()
            );

            if (indexFila === -1) {
                return res.status(400).json({ 
                    message: `El producto o la variante "${item.nombre} (${item.variante})" no existe en el inventario.` 
                });
            }

            const filaProducto = rows[indexFila];
            const numFilaExcel = indexFila + 1; // El Excel empieza en fila 1, los arrays en 0

            const estado = filaProducto[4]?.trim().toLowerCase(); // Columna E (Estado)
            const disponibles = parseInt(filaProducto[6]) || 0;    // Columna G (DISPONIBLES)

            // Validar si hay stock
            if (estado !== 'disponible' || disponibles <= 0) {
                return res.status(400).json({ 
                    message: `Lo sentimos, "${item.nombre} (${item.variante})" se encuentra agotado actualmente.` 
                });
            }

            // Dejar registrado cuántas vendidas tiene actualmente y sumarle 1
            const vendidasActuales = parseInt(filaProducto[5]) || 0; // Columna F (Vendidas)
            const nuevasVendidas = vendidasActuales + 1;

            filasAActualizar.push({
                fila: numFilaExcel,
                valor: nuevasVendidas
            });
        }

        // 4. ¡LA MAGIA! Escribir y sumar en el Excel de forma automática
        for (const update of filasAActualizar) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `Hoja 2!F${update.fila}`, // Escribe directo en la columna F (Vendidas) de esa fila
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[update.valor]]
                }
            });
        }

        // 5. Generar código de pedido y enviar respuesta exitosa
        const codigoPedido = `MB-${Math.floor(100000 + Math.random() * 900000)}`;

        // Cálculos base para el carrito
        let subtotal = items.length * 5000; 
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
        console.error("Error en API Serverless con auto-descuento:", error);
        return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
}
