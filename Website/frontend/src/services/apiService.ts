// This directory contains all the mock API calls for SAMADHAN X frontend.

export const fetchMockData = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ status: 'success', data: [] });
    }, 1000);
  });
};
