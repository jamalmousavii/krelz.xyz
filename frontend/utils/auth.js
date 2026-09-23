const authHeaders = (token) => {
  const tkn = token !== undefined ? token : localStorage.getItem('token');
  return tkn
    ? { Authorization: `Bearer ${tkn}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

export default authHeaders;
