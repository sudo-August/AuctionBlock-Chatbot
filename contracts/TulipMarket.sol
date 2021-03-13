pragma solidity ^0.5.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v2.5.0/contracts/token/ERC721/ERC721Full.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v2.5.0/contracts/ownership/Ownable.sol";
import "./TulipAuction.sol";

contract TulipMarket is ERC721Full, Ownable {

    constructor() ERC721Full(_name, _symbol) public {}

    using Counters for Counters.Counter;

    Counters.Counter token_ids;

    address payable foundation_address = msg.sender;

    mapping(uint => TulipAuction) public auctions;

    modifier nftRegistered(uint token_id) {
        require(_exists(token_id), "NFT not registered!");
        _;
    }

    function createAuction(uint token_id) public onlyOwner {
        auctions[token_id] = new TulipAuction(foundation_address);
    }

    function registernft(string memory uri) public payable onlyOwner {
        token_ids.increment();
        uint token_id = token_ids.current();
        _mint(foundation_address, token_id);
        _setTokenURI(token_id, uri);
        createAuction(token_id);
    }

    function endAuction(uint token_id) public onlyOwner nftRegistered(token_id) {
        TulipAuction auction = auctions[token_id];
        auction.auctionEnd();
        safeTransferFrom(owner(), auction.highestBidder(), token_id);
    }

    function auctionEnded(uint token_id) public view returns(bool) {
        TulipAuction auction = auctions[token_id];
        return auction.ended();
    }

    function highestBid(uint token_id) public view nftRegistered(token_id) returns(uint) {
        TulipAuction auction = auctions[token_id];
        return auction.highestBid();
    }

    function pendingReturn(uint token_id, address sender) public view nftRegistered(token_id) returns(uint) {
        TulipAuction auction = auctions[token_id];
        return auction.pendingReturn(sender);
    }

    function bid(uint token_id) public payable nftRegistered(token_id) {
        TulipAuction auction = auctions[token_id];
        auction.bid.value(msg.value)(msg.sender);
    }

}
