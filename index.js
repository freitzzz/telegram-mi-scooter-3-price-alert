const axios = require('axios').default;
const jsdom = require('jsdom');
const telegraf = require('telegraf');
const fs = require('fs');

const value_not_found = undefined;

const backup_chat_ids_file_path = 'backup.chat.ids.json';

const sources = [
    { 'name': 'Mi Store Portugal', 'url': 'https://mistoreportugal.pt/pt/produtos/trotinete-xiaomi-mi-electric-scooter-3', 'scrape_callback': scrape_value_from_mistore_portugal, 'price': 0.0 },
    // { 'name': 'PC Diga', 'url': 'https://www.pcdiga.com/casa-e-ar-livre/veiculos-e-drones/trotinetes/trotinete-electrica-xiaomi-mi-electric-scooter-3-preta-bhr4854gl', 'scrape_callback': scrape_value_from_pcdiga, 'price': 0.0 },
    { 'name': 'Worten', 'url': 'https://www.worten.pt/mobilidade/veiculos-eletricos/trotinetes-eletricas/trotinete-eletrica-xiaomi-mi-electric-scooter-3-preta-7462688', 'scrape_callback': scrape_value_from_worten, 'price': 0.0 },
    // { 'name': 'FNAC', 'url': 'https://www.fnac.pt/Trotinete-Eletrica-Xiaomi-Mi-Electric-Scooter-3-Grey-Orange-Mobilidade-urbana-Mobilidade-urbana/a9320383', 'scrape_callback': scrape_value_from_fnac, 'price': 0.0 },
    { 'name': 'Rádio Popular', 'url': 'https://www.radiopopular.pt/produto/trotinete-xiaomi-mi-3-cinza?utm_source=kuantokusta&utm_medium=cpc&utm_campaign=catalogo', 'scrape_callback': scrape_value_from_radiopopular, 'price': 0.0 },
    { 'name': 'El Corte Ingles', 'url': 'https://www.elcorteingles.pt/feed/A40922295/?utm_campaign=catalogo-kuantokusta&utm_source=kuantokusta&utm_medium=comparador', 'scrape_callback': scrape_value_from_elcorteingles, 'price': 0.0 },
    { 'name': 'Auchan', 'url': 'https://www.auchan.pt/pt/tecnologia-e-eletrodomesticos/tecnologia/eco-mobilidade/trotinetes/trotinete-xiaomi-mi-electric-scooter-3-preta/3374630.html', 'scrape_callback': scrape_value_from_auchan, 'price': 0.0 },
];

let chat_ids = [];

const bot = new telegraf.Telegraf(process.env.BOT_TOKEN);

// https://mistoreportugal.pt/pt/produtos/trotinete-xiaomi-mi-electric-scooter-3
function scrape_value_from_mistore_portugal(document) {
    const elements = document.getElementsByClassName('priceFromDesc');

    if (elements.length > 0) {
        return parseFloat(elements[0].innerHTML.slice(0, -1).replace(',', '.'));
    } else {
        return value_not_found;
    }
}

// https://www.pcdiga.com/casa-e-ar-livre/veiculos-e-drones/trotinetes/trotinete-electrica-xiaomi-mi-electric-scooter-3-preta-bhr4854gl
function scrape_value_from_pcdiga(document) {
    const element = document.getElementById('product-price-68216');

    if (element) {
        return parseFloat(element.attributes['data-price-amount'].value.replace(',', '.'));
    } else {
        return value_not_found;
    }
}

// https://www.worten.pt/mobilidade/veiculos-eletricos/trotinetes-eletricas/trotinete-eletrica-xiaomi-mi-electric-scooter-3-preta-7462688
function scrape_value_from_worten(document) {
    const elements = document.getElementsByClassName('w-product__price__current iss-product-current-price');

    if (elements.length > 0) {
        return parseFloat(elements[0].attributes['content'].value.replace(',', '.'));
    } else {
        return value_not_found;
    }
}

// https://www.fnac.pt/Trotinete-Eletrica-Xiaomi-Mi-Electric-Scooter-3-Grey-Orange-Mobilidade-urbana-Mobilidade-urbana/a9320383
function scrape_value_from_fnac(document) {
    const elements = document.getElementsByClassName('f-productOffers-tabLabel--price');

    if (elements.length > 0) {
        return parseFloat(elements[0].innerText.slice(1, -1).trim().replace(',', '.'));
    } else {
        return value_not_found;
    }
}

// https://www.radiopopular.pt/produto/trotinete-xiaomi-mi-3-cinza?utm_source=kuantokusta&utm_medium=cpc&utm_campaign=catalogo
function scrape_value_from_radiopopular(document) {
    const element = document.getElementById('product-value');

    if (element) {
        return parseFloat(element.value.replace(',', '.'));
    } else {
        return value_not_found;
    }
}

// https://www.elcorteingles.pt/feed/A40922295/?utm_campaign=catalogo-kuantokusta&utm_source=kuantokusta&utm_medium=comparador
function scrape_value_from_elcorteingles(document) {

    const elements = document.getElementsByTagName('meta');

    if (elements.length > 0) {
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].attributes[0].value === 'price') {
                return parseFloat(elements[i].attributes[1].value.replace(',', '.'));
            }
        }
    }

    return value_not_found;
}

// https://www.auchan.pt/pt/tecnologia-e-eletrodomesticos/tecnologia/eco-mobilidade/trotinetes/trotinete-xiaomi-mi-electric-scooter-3-preta/3374630.html
function scrape_value_from_auchan(document) {
    const elements = document.getElementsByClassName('value');

    if (elements.length > 0) {
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].attributes[1].name === 'content') {
                return parseFloat(elements[i].attributes[1].value.replace(',', '.'));
            }
        }
    }

    return value_not_found;
}

async function cancel_throw(func) {
    try {
        return await func();
    } catch (error) {
        return error;
    }
}

async function fetch_and_serialize(url) {
    return new jsdom.JSDOM((await axios.get(url)).data).window.document;
}

function notify_source_fetch_fail(source, error) {
    chat_ids.forEach((x) => {
        bot.telegram.sendMessage(x, `❌ Failed to fetch price for source: ${source.name}\n${error}`);
    });
}

function notify_source_price_has_risen(price_entry) {

    chat_ids.forEach((x) => {
        bot.telegram.sendMessage(x, `🚨 WARNING: Price in source ${price_entry.name} has just risen to ${price_entry.price} ! 📈`);
    });
}

function notify_source_price_has_lowed(price_entry) {
    chat_ids.forEach((x) => {
        bot.telegram.sendMessage(x, `🚨 WARNING: Price in source ${price_entry.name} has just lowed to ${price_entry.price} ! 📉`);
    });
}

function update_prices_table_and_notify(source, price) {
    if (isNaN(price)) {
        notify_source_fetch_fail(source, price);
    } else {
        const current_price = source.price;

        if (price !== current_price) {
            source.price = price;

            if (price > current_price) {
                notify_source_price_has_risen(source);
            } else {
                notify_source_price_has_lowed(source);
            }
        }
    }
}

function sync_fetch() {
    return sources.map((x) => { return { 'source': x, 'value': cancel_throw(async () => x.scrape_callback(await fetch_and_serialize(x.url))), }; });
}

async function periodic_fetch_and_update() {
    const fetched = sync_fetch();

    for (let i = 0; i < fetched.length; i++) {
        fetched[i].value.then((x) => {
            update_prices_table_and_notify(fetched[i].source, x);
        });
    }

}

function init_backup_chat_ids() {

    if (fs.existsSync(backup_chat_ids_file_path)) {
        const backup_chat_ids = JSON.parse(fs.readFileSync(backup_chat_ids_file_path).toString());

        chat_ids.push(...backup_chat_ids);
    }
}

function internal_notify_subscribed_chat_ids() {
    fs.writeFileSync(backup_chat_ids_file_path, JSON.stringify(chat_ids));
}


function telegram_start_callback(context) {

    const chat_id = context.message.chat.id;

    if (!chat_ids.includes(chat_id)) {
        chat_ids.push(chat_id);

        internal_notify_subscribed_chat_ids();

        context.reply('ℹ️ You\'ve subscribed bot notifications!');

    } else {
        context.reply('ℹ️ You\'re already subscribed.');
    }

}

function stop_callback(context) {

    const chat_id = context.message.chat.id;

    chat_ids = chat_ids.filter((x) => x == chat_id);

    internal_notify_subscribed_chat_ids();

    context.reply('ℹ️ You\'ve unsubscribed bot notifications!');
}

function telegram_current_price_callback(context) {

    let prices_table_print = 'ℹ️ Current prices 👇\n\n';

    for (x in sources) {
        prices_table_print += `[${sources[x].name}](${sources[x].url}) => ${sources[x].price}€\n`;
    }

    context.replyWithMarkdown(prices_table_print,);

}

function health_check_callback(context) {

    context.reply('✅ Alive and running');

}

function hooked_check_callback(context) {

    const chat_id = context.message.chat.id;

    if (chat_ids.includes(chat_id)) {
        context.reply('✅ You\'re subscribed to the bot.');
    } else {
        context.reply('❌ You\'re not subscribed to the bot.');
    }
}

init_backup_chat_ids();

bot.start(telegram_start_callback);

bot.command('current', telegram_current_price_callback);

bot.command('health', health_check_callback);

bot.command('hooked', hooked_check_callback);

bot.command('stop', stop_callback);

bot.launch();

periodic_fetch_and_update();

setInterval(periodic_fetch_and_update, 5 * 60000);