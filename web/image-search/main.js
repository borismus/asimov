import {formatYear, loadGraph} from '../utils.js';
import {auth} from './unsplash.js';

async function imageSearch(query) {
  const url = `https://serpapi.com/search?q=${query}&tbm=isch&ijn=0`;
  const res = await fetch(url);
  const json = await res.json();
  const images = json.images_results.map(item => item.original);

  return images;
}

async function init() {
  const data = await loadGraph('../asimov-1700.csv');
  console.log(`Loaded ${data.nodes.length} nodes.`);

  // Generate an image.conf file so that the pip script googleimagesdownload can
  // run on it.
  //
  // Example:
  // "Records": [
  // {
  //   "keywords": "apple",
  //     "limit": 5,
  //     "color": "green",
  //     "print_urls": true
  // }, ... ]
  const records = data.nodes.map(node => ({
    keywords: node.id.split('-').join(' '),
    limit: 5,
    print_urls: true,
    size: 'large',
    usage_rights: 'labeled-for-reuse',
    aspect_ratio: 'wide',
  }));
  const conf = {
    Records: records,
  }
  const pre = document.createElement('pre');
  pre.innerHTML = JSON.stringify(conf, null, 2);
  document.body.querySelector('#container').appendChild(pre);
}

window.addEventListener('load', init);
