exports.handler = async (event, context) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { items, orderCode } = JSON.parse(event.body);

        // Llamada a la API de Mercado Pago
        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Reemplaza con tu Access Token (TEST-... o APP_USR-...)
                "Authorization": `Bearer TU_ACCESS_TOKEN_AQUI` 
            },
            body: JSON.stringify({
                items: items,
                external_reference: orderCode,
                back_urls: {
                    success: "https://mundobrote.cl/exito.html", // Reemplaza por tu URL final cuando la tengas
                    failure: "https://mundobrote.cl/carrito.html",
                    pending: "https://mundobrote.cl/carrito.html"
                },
                auto_return: "approved"
            })
        });

        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify({ init_point: data.init_point })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};