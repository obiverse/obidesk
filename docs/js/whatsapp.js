/* obiDesk — WhatsApp Deep Link Builder */

var OBIDESK_WHATSAPP = '2348000000000'; // Obiverse operator number

function buildListingMessage(data) {
  return 'NEW LISTING REQUEST\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    'Business: ' + (data.bizName || '') + '\n' +
    'Owner: ' + (data.ownerName || '') + '\n' +
    'Phone: ' + (data.phone || '') + '\n' +
    'Category: ' + (data.category || '') + '\n' +
    'Area: ' + (data.area || '') + '\n' +
    (data.address ? 'Address: ' + data.address + '\n' : '') +
    (data.landmark ? 'Landmark: ' + data.landmark + '\n' : '') +
    (data.services ? '\nServices:\n' + data.services + '\n' : '') +
    (data.description ? '\nAbout:\n' + data.description + '\n' : '') +
    '\n— Sent via obiDesk';
}

function buildSystemMessage(data) {
  return 'SYSTEM REQUEST\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    'Business: ' + (data.bizName || '') + '\n' +
    'Contact: ' + (data.contactName || '') + '\n' +
    'Phone: ' + (data.phone || '') + '\n' +
    'System Type: ' + (data.systemType || '') + '\n' +
    'Budget: ' + (data.budget || '') + '\n' +
    (data.challenge ? '\nCurrent Challenge:\n' + data.challenge + '\n' : '') +
    '\n— Sent via obiDesk';
}

function openWhatsApp(number, text) {
  var url = whatsappUrl(number || OBIDESK_WHATSAPP, text);
  window.open(url, '_blank');
}
