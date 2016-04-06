import { expect } from 'chai';
import defaultExport from '../';

describe ('package main module', () => {
    describe ('default export', () => {
        it ('is a function', () => {
            expect(defaultExport).to.be.an.instanceof(Function);
        });
    });
});
