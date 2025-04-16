const https = require('https');

module.exports = async (req, res) => {
  const SHOP = 'monodsports-1394.myshopify.com';
  const TOKEN = process.env.SHOPIFY_TOKEN;

  const searchInput = req.query.query;

  if (!searchInput) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const query = {
    query: `
      {
        products(first: 10, query: "${searchInput}") {
          edges {
            node {
              title
              featuredImage {
                originalSrc
              }
              variants(first: 10) {
                edges {
                  node {
                    title
                    sku
                    price
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `
  };

  const options = {
    hostname: SHOP,
    path: '/admin/api/2023-10/graphql.json',
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(query))
    }
  };

  const shopifyReq = https.request(options, shopifyRes => {
    let body = '';

    shopifyRes.on('data', chunk => {
      body += chunk;
    });

    shopifyRes.on('end', () => {
      try {
        const result = JSON.parse(body);
        const products = result.data.products.edges;

        if (!products || products.length === 0) {
          return res.status(200).json({ message: `No products found for "${searchInput}"` });
        }

        const formatted = products.map(({ node: product }) => ({
          title: product.title,
          image: product.featuredImage?.originalSrc || null,
          variants: product.variants.edges.map(({ node: variant }) => ({
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            inventoryQuantity: variant.inventoryQuantity
          }))
        }));

        res.status(200).json(formatted);
      } catch (err) {
        console.error('Failed to parse response:', err);
        res.status(500).json({ error: 'Error parsing Shopify response', raw: body });
      }
    });
  });

  shopifyReq.on('error', err => {
    console.error('Request error:', err);
    res.status(500).json({ error: 'Shopify API request failed' });
  });

  shopifyReq.write(JSON.stringify(query));
  shopifyReq.end();
};