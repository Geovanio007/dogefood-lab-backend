// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DogeFood is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    uint256 public constant MAX_SUPPLY = 420;
    string public baseTokenURI;
    
    event DogeNFTMinted(address indexed to, uint256 indexed tokenId);
    
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        address initialOwner
    ) ERC721(_name, _symbol) Ownable(initialOwner) {
        baseTokenURI = _baseTokenURI;
    }
    
    function mint(address to) public onlyOwner {
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(to, tokenId);
        emit DogeNFTMinted(to, tokenId);
    }
    
    function batchMint(address[] calldata addresses) external onlyOwner {
        require(_tokenIdCounter + addresses.length <= MAX_SUPPLY, "Would exceed max supply");
        
        for (uint256 i = 0; i < addresses.length; i++) {
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;
            _safeMint(addresses[i], tokenId);
            emit DogeNFTMinted(addresses[i], tokenId);
        }
    }
    
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    function setBaseURI(string memory _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}