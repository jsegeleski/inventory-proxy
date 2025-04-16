const https = require('https');
const readline = require('readline');

const SHOP = 'monodsports-1394.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('🔍 Enter a product name or barcode: ', function (searchInput) {
  searchProduct(searchInput);
});

function searchProduct(searchInput) {
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

  const req = https.request(options, res => {
    let body = '';

    res.on('data', chunk => {
      body += chunk;
    });

    res.on('end', () => {
      try {
        const result = JSON.parse(body);
        const products = result.data.products.edges;

        if (products.length === 0) {
          console.log(`❌ No products found matching "${searchInput}"`);
        } else {
          products.forEach(({ node: product }) => {
            console.log(`\n🔹 ${product.title}`);
            if (product.featuredImage) {
              console.log(`🖼️ Image: ${product.featuredImage.originalSrc}`);
            }

            product.variants.edges.forEach(({ node: variant }) => {
              console.log(`  - Variant: ${variant.title}`);
              console.log(`    SKU: ${variant.sku}`);
              console.log(`    Price: $${variant.price}`);
              console.log(`    📦 Inventory: ${variant.inventoryQuantity} units`);
            });
          });
        }
      } catch (err) {
        console.error('Failed to parse response:', err);
        console.log('Raw response:', body);
      } finally {
        rl.close();
      }
    });
  });

  req.on('error', error => {
    console.error('Request error:', error);
  });

  req.write(JSON.stringify(query));
  req.end();
}