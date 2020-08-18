const dummyFn = require('../src/main');

test('dummyFn',()=>{
    expect(dummyFn('ahmed ','Mamdouh')).toBe('ahmed Mamdouh');
});