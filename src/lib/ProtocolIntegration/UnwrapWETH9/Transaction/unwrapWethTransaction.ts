import Web3 from "web3";
import { AbiItem } from 'web3-utils';
import * as dotenv from "dotenv";
import {TransactionConfig} from "web3-core";
import {TransactionReceipt} from "web3-eth";
import {IUnwrapWethDataModel} from "../Model/swapUnwrapWeth9DataModel";
//import {IWETH9} from "typechain";
//import WETH9ABI from "../../../../../../abi/Uniswap/V3/UniswapWeth9ABI";
//import {isNativeEth} from '../../common/tokens/eth';

//Configuring the directory path to access .env file
dotenv.config();
//Accessing UniswapV3Router contract's ABI
const UniswapV3RouterABI = require('../../../../../src/lib/abi/UniswapV3RouterABi.json');
const UniswapV3QuoterABI = require('../../../../../src/lib/abi/UniswapV3QuoterABI.json');
let receiptPromise: Promise<TransactionReceipt>;
/// @notice swapExactInputSingle swaps a fixed amount of Token1 for a maximum possible amount of Token1
/// using the DAI/WETH9 0.3% pool by calling `exactInputSingle` in the swap router.
/// @dev The calling address must approve this contract to spend at least `amountIn` worth of its DAI for this function to succeed.
/// @param amountIn The exact amount of DAI that will be swapped for WETH9.
/// @return amountOut The amount of WETH9 received.

export const MulticallAsync = async(unwrapWethDataModel:IUnwrapWethDataModel) : Promise<TransactionReceipt>=> {

  // Setting up Ethereum blockchain Node through Infura
  const web3 = new Web3(process.env.infuraUrlRinkeby!);

  const qWeb3 = new Web3(process.env.infuraUrlMainnet!);

  //Variable for to return
  let encoded_tx: string;

  //Providing Private Key
  const activeAccount = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY!);
  
  // Initialising the Uniswap Router Contract
  const routerContract = new web3.eth.Contract(UniswapV3RouterABI as AbiItem[], process.env.UniswapV3RinkebyRouterAddress);
  const QuoterContract = new qWeb3.eth.Contract(UniswapV3QuoterABI as AbiItem[], process.env.UniswapV3QuoterAddress);
  const weth9Address = "0xc778417E063141139Fce010982780140Aa0cD5Ab"; // Rinkeby Weth Address
  // 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 Mainnet Address

  //Setting up the deadline for the transaction
  const expiryDate = Math.floor(Date.now() / 1000) + 900;

  //Calculate AmountOutMin
  // Retrived from the mainnet
  let amountOutMin = await QuoterContract.methods.quoteExactInputSingle(unwrapWethDataModel.TokenIn,unwrapWethDataModel.TokenOut,unwrapWethDataModel.Fee ?? 3000,unwrapWethDataModel.AmountIn,'0').call();
  console.log("AmountOutMin : ",parseFloat(amountOutMin));
    
  //amountOutMin = parseFloat(amountOutMin) - (parseFloat(amountOutMin) * swapExactInputSingleDataModel.Slippage);
  
  
  //Hardcoded the value amountOutMin as it is derived from Mainnet & for sign transaction we are using Rinkeby
  //Value only work with specific input amount ex. 10000. You will need to vary if you want to test.
  //This problem won't arise once "exactInputSingle" is connected through Mainnet.
  const amountOutMinBN =0.001206727627180237*1e18; 
                            //1206727627180237
                                //105387844431
  
    
                                
    //console.log("Amount Out After Slippage : ", amountOutMin);
    
  const params = {
    tokenIn: '0xc7ad46e0b8a400bb3c915120d284aafba8fc4735', //DAI Rinkeby
    tokenOut: weth9Address, //Uni Rinkeby  0x1f9840a85d5af5bf1d1762f925bdaddc4201f984
    fee: unwrapWethDataModel.Fee ?? 3000,
    recipient: '0x0000000000000000000000000000000000000000',
    deadline: expiryDate,
    amountIn:web3.utils.toWei(unwrapWethDataModel.AmountIn!),
    amountOutMinimum: amountOutMinBN.toString(),//amountOutMinBN ?? '0', //Slippage
    sqrtPriceLimitX96: unwrapWethDataModel.SqrtPriceLimitX96 ?? '0'
  };

  //console.log("Params : ", params);
  // It will be used as count for Nonce
  const txCount = await web3.eth.getTransactionCount(activeAccount.address);

  
  // Setting up required parameters for "exactInputSingle"
  // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
  // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
  // For this example, we will set the pool fee to 0.3%.
  // The call to `exactInputSingle` executes the swap.


  const multicallData: string[] = [];

  multicallData.push(routerContract.methods.exactInputSingle(params).encodeABI());

  if(weth9Address!=unwrapWethDataModel.TokenIn){

    console.log("Entered Unwrap Eth")
    multicallData.push(routerContract.methods.unwrapWETH9(amountOutMinBN,activeAccount.address).encodeABI());
  }
    
    encoded_tx = routerContract.methods.multicall(multicallData).encodeABI();

    console.log("Encoded Text:", encoded_tx);

  

 // Creating transaction object to pass it through "signTransaction"
 let transactionObject: TransactionConfig = {
   nonce: txCount,
   gas:  4300000, // gas fee needs updating?
   gasPrice: 4200000000,
   data: encoded_tx,
   from: activeAccount.address,
   to: process.env.UniswapV3RinkebyRouterAddress,
   //value: executionQty
 };
  

  //Returning receipt for "signTransaction"
  receiptPromise = new Promise<TransactionReceipt>((resolve,reject)=>{

    try {

        let receiptObj:TransactionReceipt;
        web3.eth.accounts.signTransaction(transactionObject, activeAccount.privateKey, (error, signedTx) => {
          if (error) {
            console.log(error);
            reject(error);
          } else {
            web3.eth.sendSignedTransaction(signedTx.rawTransaction!).on('receipt', (receipt) => {
              console.log("Receipt : ",receipt);
              receiptObj=receipt;

                  });
                }
                resolve(receiptObj ?? null);
              });

          } catch (error) {
            reject(error);
            throw(error);
          }

    });

  return receiptPromise;


  
}
