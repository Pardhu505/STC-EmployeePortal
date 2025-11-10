// This function returns the list of holidays for a given year.
// The day of the week from the original list might not match if the year changes.
export const getHolidaysForYear = (year) => {
  if (!year) {
    year = new Date().getFullYear(); // Default to current year if none provided
  }

  return [
    { date: `${year}-01-01`, name: 'New Year', type: 'Fixed Holiday' },
    { date: `${year}-01-13`, name: 'Bhogi', type: 'Fixed Holiday' },
    { date: `${year}-01-14`, name: 'Sankranthi', type: 'Fixed Holiday' },
    { date: `${year}-01-15`, name: 'Kanuma Panduga', type: 'Fixed Holiday' },
    { date: `${year}-01-26`, name: 'Republic Day', type: 'National Holiday' },
    { date: `${year}-02-26`, name: 'Maha Shivaratri', type: 'Fixed Holiday' },
    { date: `${year}-03-14`, name: 'Holi', type: 'Fixed Holiday' },
    { date: `${year}-03-31`, name: 'Eid Ul Fitr', type: 'Fixed Holiday' },
    { date: `${year}-04-18`, name: 'Good Friday', type: 'Fixed Holiday' },
    { date: `${year}-05-01`, name: 'Labour Day', type: 'Fixed Holiday' },
    { date: `${year}-06-02`, name: 'Telangana Formation Day', type: 'Fixed Holiday' },
    { date: `${year}-08-15`, name: 'Independence Day', type: 'National Holiday' },
    { date: `${year}-08-27`, name: 'Ganesh Chaturthi', type: 'Fixed Holiday' },
    { date: `${year}-09-06`, name: 'Ganesh Visarjan', type: 'Fixed Holiday' },
    { date: `${year}-09-22`, name: 'Bathukamma', type: 'Fixed Holiday' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanthi', type: 'National Holiday' },
    { date: `${year}-11-05`, name: 'Guru Nanak Jayanthi', type: 'Fixed Holiday' },
    { date: `${year}-10-21`, name: 'Diwali', type: 'Fixed Holiday' },
    { date: `${year}-12-25`, name: 'Christmas', type: 'Fixed Holiday' },
  ];
};