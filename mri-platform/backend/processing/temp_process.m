
    %% Generated CAT12 Job
    spm_jobman('initcfg');
    matlabbatch = {};
    matlabbatch{1}.spm.tools.cat.estwrite.data = {'C:/Users/sathw/OneDrive/Desktop/mri-platform/backend/uploads/9eae097f-ba8b-4656-b1bb-6ff5954538bb_ADNI_011_S_0003_MR_MPR__GradWarp__B1_Correction__N3__Scaled_Br_20061206160449712_S15240_I31863.nii,1'};
    matlabbatch{1}.spm.tools.cat.estwrite.nproc = 0;
    
    % OUTPUT OPTIONS
    matlabbatch{1}.spm.tools.cat.estwrite.output.surface = 0;
    matlabbatch{1}.spm.tools.cat.estwrite.output.GM.native = 0; 
    matlabbatch{1}.spm.tools.cat.estwrite.output.GM.mod = 1; % mwp1
    matlabbatch{1}.spm.tools.cat.estwrite.output.WM.native = 0;
    
    % Run
    spm_jobman('run', matlabbatch);
    exit;
    