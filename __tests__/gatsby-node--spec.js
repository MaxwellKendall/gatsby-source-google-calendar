const sourceNodes = require("../gatsby-node").sourceNodes;
const defaultOptions = require("../gatsby-node").defaultOptions;

const createNode = jest.fn();

describe('gatsby-node', () => {
    it('works', () => {
        sourceNodes({ actions: createNode }, defaultOptions);
        expect(createNode).toHaveBeenCalled();
        expect(true).toEqual(true);
    });
});
