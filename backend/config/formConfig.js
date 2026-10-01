const T = ['Mr.', 'Ms.', 'Mrs.', 'Dr.'];
const G = ['Male', 'Female', 'Other'];
const BG = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const BFI = ['1 Star', '2 Star', '3 Star', 'Not certified'];
const men = ['47–50', '50–55', '55–60', '60–65', '65–70', '70–75', '75–80', '80–85', '85–90', '+90'];
const women = ['45–48', '48–51', '51–54', '54–57', '57–60', '60–65', '65–70', '70–75', '75–80', '+80'];
export const WEIGHTS = {
  'U-15 Boys & Girls': ['30–33', '35', '37', '40', '43', '46', '49', '52', '55', '58', '61', '64', '67', '70', '+70'],
  'U-17 Boys & Girls': ['44–46', '46–48', '48–50', '50–52', '52–54', '54–57', '57–60', '60–63', '63–66', '66–70', '70–75', '75–80', '+80'],
  'U-19 Men': men, 'U-19 Women': women, 'Elite Men': men, 'Elite Women': women
};
const base = [['Title', 'sel', T], ['Last Name', 't', [], true], ['First Name', 't', [], true]];
const pass = [['Passport Copy', 'file'], ['Passport Number', 't'], ['Passport Exp. Date', 'd']];
const contact = [['Address', 'ta', [], true], ['Mobile Number', 'tel', [], true]];
const std = [['Personal Email', 'e'], ['Gender', 'sel', G], ['Date of Birth', 'd']];
const bio = l => [l, 'ta', [], false, true];

export const ROLES = {
  Boxer: { title: 'Add New Boxer', fee: 1, sections: [
    ['Personal Details', [...base, ['Father Name', 't'], ['Gender', 'sel', G, true], ['Date of Birth', 'd', [], true],
      ['Category', 'sel', Object.keys(WEIGHTS), true, false, 'cat'], ['Weight Class (kg)', 'sel', [], true, false, 'wc'], ['Blood Group', 'sel', BG],
      ['Place & State of Birth', 't'], ['Identification Mark', 't'], ...contact, ['Personal Email', 'e'],
      ['Wins', 'n'], ['Losses', 'n'], ['Height (cm)', 'n'], ['Birth Certificate', 'file'], ['Medical Certificate', 'file'],
      ['Aadhar Copy', 'file', [], true], ...pass]],
    ['Educational Details', 'edu'], ['Sports Achievement', 'ach'],
    ['Bank Account Details', ['Account Holder Name', 'Account Number', 'Bank Name', 'IFSC Code', 'PAN Number', 'Branch'].map(x => [x, 't'])]
  ]},
  Coach: { title: 'Add New Coach', fee: 1, sections: [
    ['Personal Details', [...base, ['Father Name', 't'], ...std, ...contact, ['Aadhar Copy', 'file', [], true], ...pass]],
    ['Educational Details', 'edu'],
    ['Experience & Background', ['Qualification as a Coach', 'Boxing Career', 'Coaching / Officiating as RJ-NTO experience', 'Languages known',
      'Computer knowledge', 'Worked as, for and worked under / alongwith', 'Events participated', 'Any other contribution / information'].map(bio)]
  ]},
  Doctor: { title: 'Add New Doctor', fee: 1, sections: [['Personal Details', [...base, ...std, ['Profession', 't'], ...contact, ['Certificate', 'file', [], true], ...pass]]]},
  Physiotherapist: { title: 'Add New Physiotherapist', fee: 1, sections: [['Personal Details', [...base, ...std, ...contact, ['Certificate', 'file', [], true], ...pass]]]},
  'Referee & Judge': { title: 'Add New Referee & Judge', fee: 1, sections: [['Personal Details', [...base, ...std, ['BFI Certification Level', 'sel', BFI], ...contact, ...pass]]]
  }
};
