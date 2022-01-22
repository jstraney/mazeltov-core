const {
  DateTime
}= require('luxon');

// convenience formatters that can be used functionally to map values
// in pug mixins
const dateToSQL = (date) => DateTime.fromJSDate(date).toSQL();
const dateToISO = (date) => DateTime.fromJSDate(date).toISO();
const dateToLocal = (date) => DateTime.fromJSDate(date).toLocaleString();
const dateToFullLocal = (date) => DateTime.fromJSDate(date).toLocaleString(DateTime.DATETIME_FULL);

module.exports = {
  dateToSQL,
  dateToISO,
  dateToLocal,
  dateToFullLocal,
};
