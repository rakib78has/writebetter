// Adds DOM matchers such as toBeInTheDocument() and toHaveAccessibleName().
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not run Testing Library's automatic cleanup unless globals are
// enabled, so unmount explicitly to keep tests isolated.
afterEach(() => {
  cleanup();
});
