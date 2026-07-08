def test_single(self):
        test_data, test_loader = self._get_data(flag="TEST")

        print("loading model")
       
        model_path = r"C:\Users\drish\OneDrive\Desktop\ADformer\checkpoints\classification\ADFD-Indep\ADformer\ADFD-Indep_ftM_sl96_ll48_pl96_dm128_nh8_el6_dl1_df256_fc1_ebtimeF_dtTrue_'Exp'_seed41\checkpoint.pth"
        if not os.path.exists(model_path):
            raise Exception("No model found at %s" % model_path)
        if self.swa:
            self.swa_model.load_state_dict(torch.load(model_path))
        else:
            self.model.load_state_dict(torch.load(model_path))

        criterion = self._select_criterion()
        batch_x, label, padding_mask = next(iter(test_loader))
        batch_x = batch_x.float().to(self.device)
        padding_mask = padding_mask.float().to(self.device) 
        label = label.to(self.device)

        if self.swa:
            outputs = self.swa_model(batch_x, padding_mask, None, None)
        else:
            outputs = self.model(batch_x, padding_mask, None, None)
        print(outputs.shape)
        predictions = (
            torch.argmax(outputs, dim=1).cpu().numpy()
        )

        return(predictions)