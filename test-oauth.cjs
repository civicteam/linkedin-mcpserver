const http = require('http');
const { exec } = require('child_process');
require('dotenv').config();

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3800/callback';
const PORT = 3800;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

// LinkedIn OAuth scopes we need
const SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social'
].join(' ');

let server;

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `scope=${encodeURIComponent(SCOPES)}`;

server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error}</h1><p>${url.searchParams.get('error_description')}</p>`);
      server.close();
      return;
    }

    if (code) {
      try {
        // Exchange code for token
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI
          })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.access_token) {
          console.log('\n✅ SUCCESS! Use these environment variables:\n');
          console.log(`export ACCESS_TOKEN="${tokenData.access_token}"`);
          console.log(`export REFRESH_TOKEN="${tokenData.refresh_token || ''}"`);
          console.log(`export ACCESS_TOKEN_EXPIRES_IN="${tokenData.expires_in}"`);
          console.log(`\nToken expires in: ${tokenData.expires_in} seconds (${tokenData.expires_in / 60} minutes)`);
          console.log(`\nTo run the Docker container with these tokens:`);
          console.log(`docker run -e ACCESS_TOKEN="${tokenData.access_token}" -e REFRESH_TOKEN="${tokenData.refresh_token || ''}" -e ACCESS_TOKEN_EXPIRES_IN="${tokenData.expires_in}" civic-mcp/linkedin:latest`);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Success! Token received.</h1><p>Check your terminal for the access token and docker run command.</p>');
        } else {
          console.error('Token error:', tokenData);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error getting token</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
        }
      } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><p>${error.message}</p>`);
      }

      server.close();
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Starting OAuth flow...</h1><p>You should be redirected automatically.</p>');
  }
});

server.listen(PORT, () => {
  console.log(`\n🔐 LinkedIn OAuth Helper`);
  console.log(`\n1. Make sure ${REDIRECT_URI} is added to your LinkedIn app's "Authorized redirect URLs"`);
  console.log(`   Go to: https://www.linkedin.com/developers/apps`);
  console.log(`\n2. Opening browser to authorize...`);
  console.log(`\n   If browser doesn't open, visit: ${authUrl}\n`);

  // Try to open browser
  const command = process.platform === 'darwin' ? 'open' :
                 process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${command} "${authUrl}"`);
});
