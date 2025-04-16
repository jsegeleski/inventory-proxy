const https = require('https');

const SHOP = 'monodsports-1394.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing query param' });
  }

  const input = query.trim();

  // 💡 SKU detection
  const isLikelySKU = /^[a-zA-Z0-9\-]+$/.test(input) && input.length <= 20;

  // 🧠 Build Shopify query string
  let shopifyQuery = '';
  if (isLikelySKU) {
    shopifyQuery = `sku:${input}`;
  } else {
    const words = input.split(/\s+/).map(w => `title:*${w.replace(/"/g, '\\"')}*`);
    shopifyQuery = words.join(' AND ');
  }

  const gqlQuery = {
    query: `
      {
        products(first: 10, query: "${shopifyQuery} status:any") {
          edges {
            node {
              title
              handle
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
      'Content-Length': Buffer.byteLength(JSON.stringify(gqlQuery))
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

        const products = result.data.products.edges.map(({ node }) => ({
          title: node.title,
          image: node.featuredImage?.originalSrc || null,
          handle: node.handle,
          variants: node.variants.edges.map(({ node: v }) => ({
            title: v.title,
            sku: v.sku,
            price: v.price,
            inventoryQuantity: v.inventoryQuantity
          }))
        }));

        res.status(200).json(products);
      } catch (err) {
        console.error("Parsing error:", err);
        res.status(500).json({ error: 'Error parsing Shopify response' });
      }
    });
  });

  shopifyReq.on('error', error => {
    console.error('Request error:', error);
    res.status(500).json({ error: 'Request to Shopify failed' });
  });

  shopifyReq.write(JSON.stringify(gqlQuery));
  shopifyReq.end();
};