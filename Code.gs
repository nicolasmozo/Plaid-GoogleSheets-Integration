const CLIENT_ID = 'XXXXXXXX';
const SECRET = 'XXXXXXXXX';


function doGet() {
  const linkToken = createLinkToken();
  const html = HtmlService.createHtmlOutputFromFile('Index');
  html.append(`<script>const PLAID_LINK_TOKEN = '${linkToken}';</script>`)
  return html;
}

function fetchPlaidData(url, payload) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  }

  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
  return JSON.parse(response.getContentText());
}

function createLinkToken() {
  const url = 'https://sandbox.plaid.com/link/token/create';
  const payload = {
    client_id: CLIENT_ID,
    secret: SECRET,
    client_name: 'test',
    products: ['auth', 'transactions'],
    country_codes: ['US'],
    language: 'en',
    user: {
      client_user_id: '1',
    }
  };

  const data = fetchPlaidData(url, payload);
  return data.link_token;
}

function exchangePublicToken(publicToken) {
  const url = 'https://sandbox.plaid.com/item/public_token/exchange';
  const payload = {
    client_id: CLIENT_ID,
    secret: SECRET,
    public_token: publicToken
  };

  const data = fetchPlaidData(url, payload);
  const access_token = data.access_token;

  syncPlaidTransactions(access_token);

  return 'Access token exchanged successfully';

}

function syncPlaidTransactions(accessToken) {
  var url = 'https://sandbox.plaid.com/transactions/sync';
  var payload = {
    client_id: CLIENT_ID,
    secret: SECRET,
    access_token: accessToken,
    count: 500
  };

  var retries = 5;
  var delay = 5000;

  for (var i = 0; i < retries; i++) {
    var jsonResponse = fetchPlaidData(url, payload);

    Logger.log(JSON.stringify(jsonResponse, null, 1));

    var updateStatus = jsonResponse.transactions_update_status;

    if (updateStatus === 'NOT_READY') {
      Utilities.sleep(delay);
    } else {
      if (jsonResponse.added && jsonResponse.added.length > 0) {
        writeTransactionsToSheet(jsonResponse.added);
      } else {
        Logger.log('Transactions are not ready');
      }
      return;
    }
  }
}

function writeTransactionsToSheet(transactions){
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var headers = ['Transaction ID', 'Date', 'Name', 'Amount', 'Category'];
  sheet.clear();
  sheet.appendRow(headers);


  transactions.forEach(function(transaction){
    var row = [
      transaction.transaction_id || 'N/A',
      transaction.date || 'N/A',
      transaction.name || 'N/A',
      transaction.amount || 'N/A',
      transaction.category ? transaction.category.join(', ') : 'N/A'
    ];
    sheet.appendRow(row);
  });
}
