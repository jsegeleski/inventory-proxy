const https = require('https');

module.exports = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing query param' });
  }

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

  const graphqlQuery = {
    query: `
      {
        products(first: 5, query: "${query}") {
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
    hostname: SHOPIFY_DOMAIN,
    path: '/admin/api/2023-10/graphql.json',
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    }
  };

  const shopifyReq = https.request(options, shopifyRes => {
    let data = '';

    shopifyRes.on('data', chunk => {
      data += chunk;
    });

    shopifyRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        return res.status(200).json(result.data.products.edges);
      } catch (err) {
        return res.status(500).json({ error: 'Parsing error', raw: data });
      }
    });
  });

  shopifyReq.on('error', error => {
    return res.status(500).json({ error: error.message });
  });

  shopifyReq.write(JSON.stringify(graphqlQuery));
  shopifyReq.end();
};