export function formatYear(yearNumber) {
  if (yearNumber < 0) {
    return `${formatWithCommas(-yearNumber)} BCE`;
  } else {
    return `${formatWithCommas(yearNumber)} CE`;
  }
}

function formatWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseYear(date) {
  let [year, suffix] = date.split(' ');
  suffix = suffix ? suffix.toLowerCase() : '';
  const isBce = (suffix.indexOf('bc') >= 0);
  year = Number(year);
  return year * (isBce ? -1 : 1);
}
