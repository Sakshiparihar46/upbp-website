// Role ke hisaab se registration prefix aur fee
export const ROLES = {
  'Boxer':           { prefix: 'BX', fee: 1},
  'Coach':           { prefix: 'CO', fee: 1 },
  'Doctor':          { prefix: 'DR', fee: 1 },
  'Physiotherapist': { prefix: 'PH', fee: 1},
  'Referee & Judge': { prefix: 'RJ', fee: 1}
};

// Form label -> members table ka column. Baaki fields "data" JSON me jaate hain.
export const CORE_COLUMNS = {
  'Title': 'title', 'First Name': 'first_name', 'Last Name': 'last_name', 'Gender': 'gender',
  'Date of Birth': 'dob', 'Personal Email': 'email', 'Mobile Number': 'mobile', 'Address': 'address'
};
