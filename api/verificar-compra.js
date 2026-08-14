import { google } from 'googleapis'; // Necesitaremos la librería oficial de Google

export default async function handler(req, res) {
    // 1. Validar que la petición sea POST (seguridad)
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        const { carrito } = req.body; // Recibe el array del carrito [{id: "PRIM-FUC", cantidad: 2}, ...]
        
        // 2. Conectar de forma segura con Google Sheets usando Variables de Entorno (env)
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        // 3. Traer los datos actuales del inventario de tu "Cerebro"
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Inventario!A2:G100', // Asumiendo que tu pestaña se llama Inventario
        });
        const filas = response.data.values;

        if (!filas || filas.length === 0) {
            return res.status(500).json({ success: false, message: 'No se encontraron productos en el inventario.' });
        }

        let totalConfirmado = 0;
        let erroresStock = [];
        let actualizacionesStock = []; // Para guardar qué filas debemos modificar después

        // 4. Bucle Pro: Validar Stock y Precio de cada item enviado en el carrito
        for (const item of carrito) {
            // Buscar el producto en las filas de Google Sheets por su ID (Columna A = índice 0)
            const indiceFila = filas.findIndex(f => f[0] === item.id);
            
            if (indiceFila === -1) {
                erroresStock.push(`El producto con ID ${item.id} no existe.`);
                continue;
            }

            const filaProducto = filas[indiceFila];
            const nombrePlanta = filaProducto[1];
            const precioReal = parseInt(filaProducto[4]); // Columna E = Precio
            const stockReal = parseInt(filaProducto[5]);  // Columna F = Stock

            // ¡Freno de mano! Validar si hay stock suficiente
            if (stockReal < item.cantidad) {
                erroresStock.push(`Lo sentimos, solo quedan ${stockReal} unidades de ${nombrePlanta}.`);
            } else {
                // Si hay stock, calculamos el total con el precio REAL del servidor (anti-hackeos)
                totalConfirmado += precioReal * item.cantidad;
                
                // Calculamos el nuevo stock restante
                const nuevoStock = stockReal - item.cantidad;
                
                // Guardamos los datos para actualizar la celda correcta en Google Sheets (La fila en Excel es indiceFila + 2 por el encabezado)
                actualizacionesStock.push({
                    range: `Inventario!F${indiceFila + 2}`, // Columna F es Stock
                    values: [[nuevoStock]]
                });
            }
        }

        // 5. Si hubo errores de stock, frenamos la compra aquí y avisamos al cliente
        if (erroresStock.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Problemas con el inventario', 
                errores: erroresStock 
            });
        }

        // 6. Si todo está perfecto, aplicamos el "Congelador de Stock" en Google Sheets
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                data: actualizacionesStock,
                valueInputOption: 'USER_ENTERED'
            }
        });

        // 7. Generar el ID de Pedido Único (ej: #MB-7492)
        const idPedido = `MB-${Math.floor(1000 + Math.random() * 9000)}`;

        // (Opcional) Aquí podrías también guardar el historial del pedido en otra pestaña de Google Sheets si quisieras

        // 8. Responder con el éxito rotundo al Frontend
        return res.status(200).json({
            success: true,
            idPedido,
            total: totalConfirmado,
            message: 'Stock reservado y monto confirmado con éxito.'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor cerebro.' });
    }
}
