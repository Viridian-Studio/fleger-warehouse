export const environment = {
  production: true,
  // Productionben a frontend és az API ugyanazon a hoston fut, így relatív URL-t használunk.
  // Ha külön hoston fut az API, írd át itt (pl. 'https://api.fleger.hu/api/v1').
  apiBaseUrl: '/api/v1',
};
