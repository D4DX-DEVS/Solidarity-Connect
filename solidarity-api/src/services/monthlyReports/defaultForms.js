// Starter forms, seeded and published once when a level has no form yet. The
// state admin edits them in Report Setup. Every item is a required count ≥ 0
// that adds up the hierarchy.

const count = (id, label, extra = {}) => ({ id, type: 'number', label, required: true, min: 0, sum: true, ...extra });

export const DEFAULT_FORMS = {
  area: {
    title: 'ഏരിയ പ്രതിമാസ റിപ്പോർട്ട്',
    // Units first, as the state committee lists them; ids keep their seeded values.
    fields: [
      { id: 7, type: 'heading', label: 'യൂണിറ്റ്', helpText: 'ഏരിയയിലെ എല്ലാ യൂണിറ്റുകളുടെയും ആകെ' },
      count(8, 'യൂണിറ്റ് മീറ്റിംഗ്'),
      count(9, 'യൂത്ത് മീറ്റ്'),
      count(10, 'യൂത്ത് ആക്റ്റിവിറ്റി'),
      { id: 1, type: 'heading', label: 'ഏരിയ' },
      count(2, 'ഏരിയ സെക്രട്ടേറിയേറ്റ്'),
      count(3, 'ഏരിയ സമിതി'),
      count(4, 'മെമ്പേഴ്‌സ് മീറ്റ്'),
      count(5, 'മെമ്പേഴ്‌സ് മീറ്റിൽ പങ്കെടുത്തവരുടെ എണ്ണം', {
        helpText: 'മെമ്പേഴ്‌സ് മീറ്റിൽ എത്ര പേർ പങ്കെടുത്തു',
        condition: { fieldId: 4, operator: 'greater_than', value: '0' },
      }),
      count(6, 'യൂത്ത് മീറ്റ്'),
    ],
  },
  district: {
    title: 'ജില്ലാ പ്രതിമാസ റിപ്പോർട്ട്',
    fields: [
      count(1, 'ജില്ലാ സെക്രട്ടേറിയേറ്റ്'),
      count(2, 'ജില്ലാ സമിതി'),
    ],
  },
  state: {
    title: 'സംസ്ഥാന പ്രതിമാസ റിപ്പോർട്ട്',
    fields: [
      count(1, 'സെക്രട്ടറിയേറ്റ്'),
      count(2, 'സംസ്ഥാന സമിതി'),
      count(3, 'DPDGS'),
    ],
  },
};
