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
