import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    files: ['context/ShopContext.tsx'],
    rules: {
      'react-hooks/purity': 'off',
    },
  },
];

export default eslintConfig;
